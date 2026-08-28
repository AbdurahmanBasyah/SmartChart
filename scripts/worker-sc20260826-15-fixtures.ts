import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  authenticateQstashRequest,
  captureRawRequestBody,
  parseRequestBody,
  RawBodyUnavailableError,
  verifyQstashRequest,
} from "../api/_lib/qstash.js";
import syncControllerHandler from "../api/jobs/stocks/sync.js";
import syncTickerHandler from "../api/jobs/stocks/sync-ticker.js";

const CURRENT_KEY = "fixture-current-key";
const NEXT_KEY = "fixture-next-key";
const WRONG_KEY = "fixture-wrong-key";

type Listener = (...args: unknown[]) => void;

class FakeReadableRequest {
  readableEnded = false;
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener): this {
    const eventListeners = this.listeners.get(event) ?? new Set<Listener>();
    eventListeners.add(listener);
    this.listeners.set(event, eventListeners);
    return this;
  }

  removeListener(event: string, listener: Listener): this {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  listenerCount(): number {
    let count = 0;
    for (const listeners of this.listeners.values()) count += listeners.size;
    return count;
  }

  finish(chunks: Array<string | Uint8Array>): void {
    for (const chunk of chunks) this.emit("data", chunk);
    this.readableEnded = true;
    this.emit("end");
  }

  private emit(event: string, ...args: unknown[]): void {
    for (const listener of [...(this.listeners.get(event) ?? [])]) listener(...args);
  }
}

function streamRequest(
  headers: Record<string, string> = {},
  body?: unknown,
): FakeReadableRequest & { method: string; headers: Record<string, string>; body?: unknown } {
  return Object.assign(new FakeReadableRequest(), { method: "POST", headers, body });
}

function signFixtureBody(body: string, key: string): string {
  return createHmac("sha256", key).update(body, "utf8").digest("base64url");
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function signQstashJwt(body: string, key: string): string {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({
    iss: "Upstash",
    body: createHash("sha256").update(body, "utf8").digest("base64url"),
    exp: Math.floor(Date.now() / 1000) + 300,
  }));
  const encoded = `${header}.${payload}`;
  const signature = createHmac("sha256", key).update(encoded, "ascii").digest("base64url");
  return `${encoded}.${signature}`;
}

function makeFakeReceiverFactory(seenBodies: string[]) {
  return ({ currentSigningKey, nextSigningKey }: {
    currentSigningKey: string;
    nextSigningKey: string;
  }) => ({
    verify: async ({ body, signature }: { body: string; signature: string }) => {
      seenBodies.push(body);
      return signature === signFixtureBody(body, currentSigningKey)
        || signature === signFixtureBody(body, nextSigningKey);
    },
  });
}

function makeResponse() {
  const state: { status?: number; payload?: unknown } = {};
  const response = {
    setHeader: () => response,
    status: (status: number) => {
      state.status = status;
      return response;
    },
    json: (payload: unknown) => {
      state.payload = payload;
      return response;
    },
    end: () => response,
    state,
  };
  return response;
}

async function main(): Promise<void> {
  const previousCurrent = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const previousNext = process.env.QSTASH_NEXT_SIGNING_KEY;
  const previousRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const previousQstashToken = process.env.QSTASH_TOKEN;
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;

  process.env.QSTASH_CURRENT_SIGNING_KEY = CURRENT_KEY;
  process.env.QSTASH_NEXT_SIGNING_KEY = NEXT_KEY;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.QSTASH_TOKEN;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    throw new Error("unexpected external fetch in auth fixture");
  }) as typeof fetch;

  try {
    const rawBodies = [
      "",
      "{}",
      '{"ticker":"BBCA"}',
      '{\n  "ticker": "BBCA",\n  "tradeDate": "2026-08-26"\n}',
      " \n{\"ticker\":\"BBCA\"}\t",
    ];

    for (const rawBody of rawBodies) {
      const request = streamRequest({}, { parsed: "object must not be serialized" });
      const firstCapture = captureRawRequestBody(request);
      const secondCapture = captureRawRequestBody(request);
      assert.equal(firstCapture, secondCapture, "request stream must be captured only once");
      request.finish([Buffer.from(rawBody.slice(0, Math.ceil(rawBody.length / 2)), "utf8"), rawBody.slice(Math.ceil(rawBody.length / 2))]);
      assert.equal(await firstCapture, rawBody, "stream capture must preserve body bytes/text exactly");
    }

    const bufferBody = '{\n  "ticker": "BBCA"\n}';
    assert.equal(
      await captureRawRequestBody({ rawBody: Buffer.from(bufferBody, "utf8") }),
      bufferBody,
      "explicit Buffer rawBody must be preserved",
    );
    assert.equal(
      await captureRawRequestBody({ rawBody: bufferBody }),
      bufferBody,
      "explicit string rawBody must be preserved",
    );
    assert.equal(
      await captureRawRequestBody({ body: Buffer.from(bufferBody, "utf8"), readableEnded: true }),
      bufferBody,
      "Vercel Buffer body fallback must be preserved",
    );
    assert.equal(
      await captureRawRequestBody({ body: bufferBody, readableEnded: true }),
      bufferBody,
      "Vercel string body fallback must be preserved",
    );
    await assert.rejects(
      captureRawRequestBody({ body: { ticker: "BBCA" }, readableEnded: true }),
      (error: unknown) => error instanceof RawBodyUnavailableError,
      "parsed object must never be reconstructed as a signed body",
    );

    const seenBodies: string[] = [];
    const fakeReceiverFactory = makeFakeReceiverFactory(seenBodies);
    for (const rawBody of rawBodies) {
      const currentResult = await verifyQstashRequest(
        { headers: { "Upstash-Signature": signFixtureBody(rawBody, CURRENT_KEY) } },
        rawBody,
        fakeReceiverFactory,
      );
      assert.deepEqual(currentResult, { ok: true }, "current signing key must verify");

      const nextResult = await verifyQstashRequest(
        { headers: { "upstash-signature": signFixtureBody(rawBody, NEXT_KEY) } },
        rawBody,
        fakeReceiverFactory,
      );
      assert.deepEqual(nextResult, { ok: true }, "next signing key must verify");
    }
    assert.equal(seenBodies.includes(" \n{\"ticker\":\"BBCA\"}\t"), true);

    const compactBody = '{"ticker":"BBCA"}';
    const whitespaceBody = '{ "ticker": "BBCA" }';
    assert.deepEqual(parseRequestBody( compactBody), parseRequestBody(whitespaceBody));
    const tamperedResult = await verifyQstashRequest(
      { headers: { "Upstash-Signature": signFixtureBody(compactBody, CURRENT_KEY) } },
      whitespaceBody,
      fakeReceiverFactory,
    );
    assert.deepEqual(tamperedResult, {
      ok: false,
      status: 401,
      code: "INVALID_QSTASH_SIGNATURE",
    }, "body whitespace tampering must fail even when parsed JSON is equal");

    const wrongKeyResult = await verifyQstashRequest(
      { headers: { "Upstash-Signature": signFixtureBody(compactBody, WRONG_KEY) } },
      compactBody,
      fakeReceiverFactory,
    );
    assert.deepEqual(wrongKeyResult, {
      ok: false,
      status: 401,
      code: "INVALID_QSTASH_SIGNATURE",
    }, "signature from an unknown key must fail");

    const missingResult = await authenticateQstashRequest(
      { body: { parsed: "object" }, readableEnded: true },
      fakeReceiverFactory,
    );
    assert.deepEqual(missingResult, {
      ok: false,
      status: 401,
      code: "MISSING_QSTASH_SIGNATURE",
    }, "missing signature must be rejected before body capture");

    const unavailableResult = await authenticateQstashRequest(
      { headers: { "Upstash-Signature": "fixture-signature" }, body: { parsed: "object" }, readableEnded: true },
      fakeReceiverFactory,
    );
    assert.deepEqual(unavailableResult, {
      ok: false,
      status: 503,
      code: "RAW_BODY_UNAVAILABLE",
    }, "raw body failure must be controlled and must not serialize parsed JSON");

    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    const missingKeysResult = await authenticateQstashRequest(
      { rawBody: "{}", headers: { "Upstash-Signature": "fixture-signature" } },
      fakeReceiverFactory,
    );
    assert.deepEqual(missingKeysResult, {
      ok: false,
      status: 503,
      code: "QSTASH_KEYS_NOT_CONFIGURED",
    }, "missing signing keys must fail closed before verification");
    process.env.QSTASH_CURRENT_SIGNING_KEY = CURRENT_KEY;

    const malformedBody = '{"ticker":';
    const malformedAuth = await authenticateQstashRequest(
      { rawBody: malformedBody, headers: { "Upstash-Signature": signFixtureBody(malformedBody, CURRENT_KEY) } },
      fakeReceiverFactory,
    );
    assert.equal(malformedAuth.ok, true, "signature verification must precede JSON parsing");
    if (malformedAuth.ok) {
      assert.throws(() => parseRequestBody(malformedAuth.rawBody), SyntaxError);
    }

    const controllerValidRequest = streamRequest(
      { "Upstash-Signature": signFixtureBody("", CURRENT_KEY) },
    );
    const controllerValidAuthPromise = authenticateQstashRequest(controllerValidRequest, fakeReceiverFactory);
    controllerValidRequest.finish([]);
    const controllerValidAuth = await controllerValidAuthPromise;
    assert.equal(controllerValidAuth.ok, true, "valid empty controller body must authenticate");

    const tickerValidBody = '{\n  "runId": "fixture-run",\n  "ticker": "BBCA",\n  "tradeDate": "2026-08-26"\n}';
    const tickerValidRequest = streamRequest(
      { "Upstash-Signature": signFixtureBody(tickerValidBody, NEXT_KEY) },
      { parsed: "must not be used" },
    );
    const tickerValidAuthPromise = authenticateQstashRequest(tickerValidRequest, fakeReceiverFactory);
    tickerValidRequest.finish([Buffer.from(tickerValidBody, "utf8")]);
    const tickerValidAuth = await tickerValidAuthPromise;
    assert.equal(tickerValidAuth.ok, true, "valid ticker body must authenticate");

    let fakeBusinessCalls = 0;
    for (const authentication of [controllerValidAuth, tickerValidAuth]) {
      if (authentication.ok) {
        fakeBusinessCalls += 1;
        parseRequestBody(authentication.rawBody);
      }
    }
    assert.equal(fakeBusinessCalls, 2, "both endpoint auth paths must reach the post-auth business boundary");

    const missingControllerResponse = makeResponse();
    await syncControllerHandler({ method: "POST", headers: {}, body: { parsed: "object" } }, missingControllerResponse);
    assert.equal(missingControllerResponse.state.status, 401);
    assert.deepEqual(missingControllerResponse.state.payload, { error: "MISSING_QSTASH_SIGNATURE" });

    const missingTickerResponse = makeResponse();
    await syncTickerHandler({ method: "POST", headers: {}, body: { parsed: "object" } }, missingTickerResponse);
    assert.equal(missingTickerResponse.state.status, 401);
    assert.deepEqual(missingTickerResponse.state.payload, { error: "MISSING_QSTASH_SIGNATURE" });

    const invalidControllerRequest = streamRequest(
      { "Upstash-Signature": "invalid-fixture-signature" },
    );
    const invalidControllerResponse = makeResponse();
    const invalidControllerPromise = syncControllerHandler(invalidControllerRequest, invalidControllerResponse);
    invalidControllerRequest.finish([Buffer.from("{}", "utf8")]);
    await invalidControllerPromise;
    assert.equal(invalidControllerResponse.state.status, 401);
    assert.deepEqual(invalidControllerResponse.state.payload, { error: "INVALID_QSTASH_SIGNATURE" });

    const invalidTickerRequest = streamRequest(
      { "Upstash-Signature": "invalid-fixture-signature" },
    );
    const invalidTickerResponse = makeResponse();
    const invalidTickerPromise = syncTickerHandler(invalidTickerRequest, invalidTickerResponse);
    invalidTickerRequest.finish([Buffer.from(tickerValidBody, "utf8")]);
    await invalidTickerPromise;
    assert.equal(invalidTickerResponse.state.status, 401);
    assert.deepEqual(invalidTickerResponse.state.payload, { error: "INVALID_QSTASH_SIGNATURE" });
    assert.equal(fetchCalls, 0, "missing/invalid auth must not reach provider, fan-out, lock, or Redis");

    const realControllerBody = "";
    const realControllerRequest = streamRequest(
      {
        "Upstash-Signature": signQstashJwt(realControllerBody, CURRENT_KEY),
        host: "example.invalid",
      },
    );
    const realControllerResponse = makeResponse();
    const realControllerPromise = syncControllerHandler(realControllerRequest, realControllerResponse);
    realControllerRequest.finish([]);
    await realControllerPromise;
    assert.equal(realControllerResponse.state.status, 400);
    assert.deepEqual(realControllerResponse.state.payload, { error: "MISSING_QSTASH_MESSAGE_ID" });

    const realMalformedControllerRequest = streamRequest({
      "Upstash-Signature": signQstashJwt(malformedBody, CURRENT_KEY),
      host: "example.invalid",
    });
    const realMalformedControllerResponse = makeResponse();
    const realMalformedControllerPromise = syncControllerHandler(
      realMalformedControllerRequest,
      realMalformedControllerResponse,
    );
    realMalformedControllerRequest.finish([Buffer.from(malformedBody, "utf8")]);
    await realMalformedControllerPromise;
    assert.equal(realMalformedControllerResponse.state.status, 400);
    assert.deepEqual(realMalformedControllerResponse.state.payload, { error: "INVALID_SYNC_PAYLOAD" });

    const realTickerRequest = streamRequest({
      "Upstash-Signature": signQstashJwt(tickerValidBody, NEXT_KEY),
    });
    const realTickerResponse = makeResponse();
    const realTickerPromise = syncTickerHandler(realTickerRequest, realTickerResponse);
    realTickerRequest.finish([Buffer.from(tickerValidBody, "utf8")]);
    await realTickerPromise;
    assert.equal(realTickerResponse.state.status, 503);
    assert.deepEqual(realTickerResponse.state.payload, { error: "REDIS_NOT_CONFIGURED" });
    assert.equal(fetchCalls, 0, "verified fixture requests stop at the local no-Redis business boundary");

    const getControllerResponse = makeResponse();
    await syncControllerHandler({ method: "GET", headers: {} }, getControllerResponse);
    assert.equal(getControllerResponse.state.status, 405);
    const getTickerResponse = makeResponse();
    await syncTickerHandler({ method: "GET", headers: {} }, getTickerResponse);
    assert.equal(getTickerResponse.state.status, 405);

    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const qstashSource = readFileSync(resolve(root, "api/_lib/qstash.ts"), "utf8");
    const controllerSource = readFileSync(resolve(root, "api/jobs/stocks/sync.ts"), "utf8");
    const tickerSource = readFileSync(resolve(root, "api/jobs/stocks/sync-ticker.ts"), "utf8");
    const vercelSource = readFileSync(resolve(root, "vercel.json"), "utf8");
    assert.equal(qstashSource.includes("JSON.stringify(req.body"), false, "parsed body must not be reserialized for verification");
    assert.equal(qstashSource.includes("devMode"), false, "production verifier must not enable dev mode");
    assert.equal(qstashSource.includes("console.log"), false, "verifier must not log credentials/signatures/body");
    assert.equal(controllerSource.includes("export const config = { api: { bodyParser: false } }"), true);
    assert.equal(tickerSource.includes("export const config = { api: { bodyParser: false } }"), true);
    assert.equal(controllerSource.includes("authenticateQstashRequest"), true);
    assert.equal(tickerSource.includes("authenticateQstashRequest"), true);
    assert.equal(controllerSource.indexOf("authenticateQstashRequest") < controllerSource.indexOf("runSyncController"), true);
    assert.equal(tickerSource.indexOf("authenticateQstashRequest") < tickerSource.indexOf("runSyncTicker"), true);
    assert.equal(vercelSource.includes("smartchart-stocks-daily"), false, "schedule resource must remain outside source changes");

    console.log("SC-20260826-15 fixture PASS");
    console.log("raw stream/Buffer/string byte preservation: PASS");
    console.log("current/next/tampered/missing/malformed auth contract: PASS");
    console.log("controller/ticker auth ordering and no-external-work guard: PASS");
    console.log("Vercel parser config and production static security audit: PASS");
  } finally {
    globalThis.fetch = originalFetch;
    if (previousCurrent === undefined) delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    else process.env.QSTASH_CURRENT_SIGNING_KEY = previousCurrent;
    if (previousNext === undefined) delete process.env.QSTASH_NEXT_SIGNING_KEY;
    else process.env.QSTASH_NEXT_SIGNING_KEY = previousNext;
    if (previousRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = previousRedisUrl;
    if (previousRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = previousRedisToken;
    if (previousQstashToken === undefined) delete process.env.QSTASH_TOKEN;
    else process.env.QSTASH_TOKEN = previousQstashToken;
  }
}

main().catch((error) => {
  console.error(
    "SC-20260826-15 fixture FAIL",
    error instanceof Error ? error.message : "unknown error",
  );
  process.exitCode = 1;
});
