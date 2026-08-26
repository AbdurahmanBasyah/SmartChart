import { Client, Receiver } from "@upstash/qstash";
import { QSTASH_STOCK_SYNC_CRON } from "./rawOhlcvSnapshot.js";

export const STOCK_SYNC_SCHEDULE_ID = "smartchart-stocks-daily";
export const STOCK_SYNC_FLOW_CONTROL_KEY = "smartchart-stocks-sync";
export const STOCK_SYNC_MAX_PARALLELISM = 8;
export const STOCK_SYNC_QSTASH_RETRIES = 2;

export type QStashBatchMessage = {
  url: string;
  body: unknown;
  headers: Record<string, string>;
  retries: number;
  flowControl: {
    key: string;
    parallelism: number;
  };
};

export interface QStashPublisher {
  batchJSON(messages: QStashBatchMessage[]): Promise<unknown[]>;
}

type RequestLike = {
  body?: unknown;
  rawBody?: unknown;
  headers?: Record<string, string | string[] | undefined>;
  protocol?: string;
  get?: (name: string) => string | undefined;
  url?: string;
  readableEnded?: boolean;
  on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
  once?: (event: string, listener: (...args: unknown[]) => void) => unknown;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => unknown;
};

export function getHeader(req: RequestLike, name: string): string | undefined {
  const expected = name.toLowerCase();
  const headers = req.headers ?? {};
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === expected)?.[1];
  if (Array.isArray(found)) return found[0];
  if (typeof found === "string") return found;
  return req.get?.(name) ?? req.get?.(name.toLowerCase());
}

export class RawBodyUnavailableError extends Error {
  readonly code = "RAW_BODY_UNAVAILABLE" as const;

  constructor() {
    super("RAW_BODY_UNAVAILABLE");
    this.name = "RawBodyUnavailableError";
  }
}

const rawBodyCaptureCache = new WeakMap<object, Promise<string>>();

function bodyCandidateToString(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("utf8");
  }
  return undefined;
}

function readRawBodyStream(req: RequestLike): Promise<string> {
  if (!req.on) throw new RawBodyUnavailableError();

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const cleanup = () => {
      req.removeListener?.("data", onData);
      req.removeListener?.("end", onEnd);
      req.removeListener?.("error", onError);
      req.removeListener?.("aborted", onAborted);
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new RawBodyUnavailableError());
    };
    const onData = (chunk: unknown) => {
      if (typeof chunk === "string") {
        chunks.push(Buffer.from(chunk, "utf8"));
        return;
      }
      if (typeof Buffer !== "undefined" && Buffer.isBuffer(chunk)) {
        chunks.push(chunk);
        return;
      }
      if (chunk instanceof Uint8Array) {
        chunks.push(Buffer.from(chunk));
        return;
      }
      fail();
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks).toString("utf8"));
    };
    const onError = () => fail();
    const onAborted = () => fail();

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });
}

async function captureRawRequestBodyUncached(req: RequestLike): Promise<string> {
  const explicitRawBody = bodyCandidateToString(req.rawBody);
  if (explicitRawBody !== undefined) return explicitRawBody;

  if (req.readableEnded !== true && req.on) {
    return readRawBodyStream(req);
  }

  const bodyCandidate = bodyCandidateToString(req.body);
  if (bodyCandidate !== undefined) return bodyCandidate;

  throw new RawBodyUnavailableError();
}

/**
 * Capture the bytes available from the Vercel Node request exactly once.
 * Parsed JSON objects are intentionally not serialized back into a body.
 */
export function captureRawRequestBody(req: RequestLike): Promise<string> {
  const requestObject = req as object;
  const existing = rawBodyCaptureCache.get(requestObject);
  if (existing) return existing;

  const capture = captureRawRequestBodyUncached(req);
  rawBodyCaptureCache.set(requestObject, capture);
  return capture;
}

/** @deprecated Use captureRawRequestBody so callers cannot reconstruct parsed JSON. */
export function getRawRequestBody(req: RequestLike): Promise<string> {
  return captureRawRequestBody(req);
}

export function parseRequestBody<T>(rawBody: string): T {
  if (!rawBody.trim()) return {} as T;
  return JSON.parse(rawBody) as T;
}

export type QStashVerification =
  | { ok: true }
  | {
      ok: false;
      status: 401 | 503;
      code:
        | "MISSING_QSTASH_SIGNATURE"
        | "INVALID_QSTASH_SIGNATURE"
        | "QSTASH_KEYS_NOT_CONFIGURED"
        | "RAW_BODY_UNAVAILABLE";
    };

export type QStashReceiverLike = {
  verify(request: { body: string; signature: string }): Promise<boolean>;
};

export type QStashReceiverFactory = (keys: {
  currentSigningKey: string;
  nextSigningKey: string;
}) => QStashReceiverLike;

export type QStashAuthentication =
  | { ok: true; rawBody: string }
  | {
      ok: false;
      status: 401 | 503;
      code:
        | "MISSING_QSTASH_SIGNATURE"
        | "INVALID_QSTASH_SIGNATURE"
        | "QSTASH_KEYS_NOT_CONFIGURED"
        | "RAW_BODY_UNAVAILABLE";
    };

const createDefaultReceiver: QStashReceiverFactory = ({ currentSigningKey, nextSigningKey }) =>
  new Receiver({ currentSigningKey, nextSigningKey });

export async function verifyQstashRequest(
  req: RequestLike,
  rawBody?: string,
  receiverFactory: QStashReceiverFactory = createDefaultReceiver,
): Promise<QStashVerification> {
  const signature = getHeader(req, "Upstash-Signature");
  if (!signature) {
    return { ok: false, status: 401, code: "MISSING_QSTASH_SIGNATURE" };
  }
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY?.trim();
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY?.trim();
  if (!currentSigningKey || !nextSigningKey) {
    return { ok: false, status: 503, code: "QSTASH_KEYS_NOT_CONFIGURED" };
  }

  try {
    const body = rawBody ?? (await captureRawRequestBody(req));
    const receiver = receiverFactory({ currentSigningKey, nextSigningKey });
    const verified = await receiver.verify({ body, signature });
    if (verified !== true) throw new Error("INVALID_QSTASH_SIGNATURE");
    return { ok: true };
  } catch (error) {
    if (error instanceof RawBodyUnavailableError) {
      return { ok: false, status: 503, code: "RAW_BODY_UNAVAILABLE" };
    }
    return { ok: false, status: 401, code: "INVALID_QSTASH_SIGNATURE" };
  }
}

export async function authenticateQstashRequest(
  req: RequestLike,
  receiverFactory: QStashReceiverFactory = createDefaultReceiver,
): Promise<QStashAuthentication> {
  if (!getHeader(req, "Upstash-Signature")) {
    return { ok: false, status: 401, code: "MISSING_QSTASH_SIGNATURE" };
  }

  let rawBody: string;
  try {
    rawBody = await captureRawRequestBody(req);
  } catch (error) {
    if (error instanceof RawBodyUnavailableError) {
      return { ok: false, status: 503, code: "RAW_BODY_UNAVAILABLE" };
    }
    return { ok: false, status: 503, code: "RAW_BODY_UNAVAILABLE" };
  }

  const verification = await verifyQstashRequest(req, rawBody, receiverFactory);
  if (verification.ok === false) {
    return { ok: false, status: verification.status, code: verification.code };
  }
  return { ok: true, rawBody };
}

export function getPublicAppUrl(req?: RequestLike): string {
  const configured = process.env.APP_URL?.trim();
  if (configured) {
    let url: URL;
    try {
      url = new URL(configured);
    } catch {
      throw new Error("APP_URL_NOT_CONFIGURED");
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("APP_URL_NOT_CONFIGURED");
    }
    return configured.replace(/\/$/, "");
  }

  const host = getHeader(req ?? {}, "host")?.trim();
  if (!host || /[\s\r\n]/.test(host)) throw new Error("APP_URL_NOT_CONFIGURED");
  const forwardedProto = getHeader(req ?? {}, "x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProto === "http" ? "http" : "https";
  return `${protocol}://${host}`;
}

export function createQStashPublisher(): QStashPublisher {
  const token = process.env.QSTASH_TOKEN?.trim();
  if (!token) throw new Error("QSTASH_TOKEN_NOT_CONFIGURED");
  const client = new Client({ token });
  return {
    batchJSON: (messages) => client.batchJSON(messages as any),
  };
}

export function buildStockSyncScheduleRequest(destination: string): {
  destination: string;
  scheduleId: string;
  cron: string;
  method: "POST";
  body: string;
  headers: Record<string, string>;
  retries: number;
} {
  return {
    destination,
    scheduleId: STOCK_SYNC_SCHEDULE_ID,
    cron: QSTASH_STOCK_SYNC_CRON,
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
    retries: STOCK_SYNC_QSTASH_RETRIES,
  };
}

export async function createStockSyncSchedule(
  client: { schedules: { create: (request: ReturnType<typeof buildStockSyncScheduleRequest>) => Promise<unknown> } },
  destination: string,
): Promise<unknown> {
  return client.schedules.create(buildStockSyncScheduleRequest(destination));
}
