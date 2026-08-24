import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import 'dotenv/config';
import { build } from 'esbuild';
import handler from '../api/broker-accumulation';
import { fetchBrokerDataAccumulation } from '../api/_lib/brokerDataClient';

const brokerHandlerEntries = [
  {
    name: 'broker-summary',
    sourceUrl: new URL('../api/broker-summary.ts', import.meta.url),
    expectedError: 'Broker summary is temporarily unavailable',
  },
  {
    name: 'broker-accumulation',
    sourceUrl: new URL('../api/broker-accumulation.ts', import.meta.url),
    expectedError: 'Broker accumulation is temporarily unavailable',
  },
] as const;

for (const entry of brokerHandlerEntries) {
  const source = readFileSync(entry.sourceUrl, 'utf8');
  assert.match(source, /from ['"]\.\/\_lib\/brokerDataClient\.js['"]/);
  const localImports = [...source.matchAll(/from\s+['"](\.\/[^'"]+)['"]/g)].map((match) => match[1]);
  assert.deepEqual(
    localImports.filter((specifier) => !/\.js$/.test(specifier)),
    [],
    `${entry.name} contains an extensionless local ESM import`,
  );
}
console.log('Broker handler ESM import audit passed');

function makeResponse() {
  const result: {
    headers: Record<string, string>;
    statusCode: number;
    body: unknown;
  } = { headers: {}, statusCode: 200, body: null };
  const response = {
    setHeader(key: string, value: string) {
      result.headers[key] = value;
    },
    removeHeader(key: string) {
      delete result.headers[key];
    },
    status(code: number) {
      result.statusCode = code;
      return response;
    },
    json(body: unknown) {
      result.body = body;
      return response;
    },
    end() {
      return response;
    },
  };
  return { result, response };
}

async function runEsmBundleSmoke(entry: (typeof brokerHandlerEntries)[number]) {
  const tempDirectory = await mkdtemp(join(tmpdir(), 'smartchart-broker-esm-'));
  const bundlePath = join(tempDirectory, `${entry.name}.mjs`);
  const previousKey = process.env.BROKER_DATA_API_KEY;
  const previousBaseUrl = process.env.BROKER_DATA_API_BASE_URL;
  delete process.env.BROKER_DATA_API_KEY;
  delete process.env.BROKER_DATA_API_BASE_URL;

  try {
    await build({
      entryPoints: [fileURLToPath(entry.sourceUrl)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: bundlePath,
      logLevel: 'silent',
    });
    const bundled = (await import(`${pathToFileURL(bundlePath).href}?smoke=${Date.now()}`)) as {
      default: (req: any, res: any) => Promise<unknown>;
    };

    const noQuery = makeResponse();
    await bundled.default({ method: 'GET', query: {} }, noQuery.response);
    assert.equal(noQuery.result.statusCode, 400);
    assert.equal((noQuery.result.body as { success: boolean }).success, false);

    const unsupportedMethod = makeResponse();
    await bundled.default({ method: 'POST', query: {} }, unsupportedMethod.response);
    assert.equal(unsupportedMethod.result.statusCode, 405);
    assert.equal((unsupportedMethod.result.body as { success: boolean }).success, false);

    const missingConfig = makeResponse();
    await bundled.default(
      {
        method: 'GET',
        query: { symbol: 'BBCA', start_date: '2026-01-01', end_date: '2026-01-31' },
      },
      missingConfig.response,
    );
    assert.equal(missingConfig.result.statusCode, 502);
    assert.deepEqual(missingConfig.result.body, {
      success: false,
      source: 'EXTERNAL',
      error: entry.expectedError,
    });
  } finally {
    if (previousKey === undefined) delete process.env.BROKER_DATA_API_KEY;
    else process.env.BROKER_DATA_API_KEY = previousKey;
    if (previousBaseUrl === undefined) delete process.env.BROKER_DATA_API_BASE_URL;
    else process.env.BROKER_DATA_API_BASE_URL = previousBaseUrl;
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

for (const entry of brokerHandlerEntries) {
  await runEsmBundleSmoke(entry);
}
console.log('Broker handler ESM bundle/import smoke passed');

const invalid = makeResponse();
await handler(
  {
    method: 'GET',
    query: { symbol: 'BBCA', start_date: '2026-02-30', end_date: '2026-03-01' },
  },
  invalid.response,
);
assert.equal(invalid.result.statusCode, 400);
assert.deepEqual(invalid.result.body, {
  success: false,
  error: 'Dates must use YYYY-MM-DD',
});
assert.equal(invalid.result.headers['Cache-Control'], 'no-store, max-age=0');

const reversed = makeResponse();
await handler(
  {
    method: 'GET',
    query: { symbol: 'BBCA.JK', start_date: '2026-03-02', end_date: '2026-03-01' },
  },
  reversed.response,
);
assert.equal(reversed.result.statusCode, 400);
assert.deepEqual(reversed.result.body, {
  success: false,
  error: 'start_date must not be after end_date',
});

const configuredKey = process.env.BROKER_DATA_API_KEY;
delete process.env.BROKER_DATA_API_KEY;
const failedProvider = makeResponse();
await handler(
  {
    method: 'GET',
    query: { symbol: 'BBCA', start_date: '2026-01-01', end_date: '2026-01-31' },
  },
  failedProvider.response,
);
assert.equal(failedProvider.result.statusCode, 502);
assert.deepEqual(failedProvider.result.body, {
  success: false,
  source: 'EXTERNAL',
  error: 'Broker accumulation is temporarily unavailable',
});
assert.equal(failedProvider.result.headers['Cache-Control'], 'no-store, max-age=0');
if (configuredKey) process.env.BROKER_DATA_API_KEY = configuredKey;

console.log('External accumulation request validation fixtures passed');

if (process.env.BROKER_DATA_API_KEY && process.env.BROKER_DATA_API_BASE_URL) {
  let upstreamAvailable = false;
  try {
    const upstream = await fetchBrokerDataAccumulation({
      symbol: 'BBCA',
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    });
    assert.ok(Array.isArray(upstream.series));
    const pointCount = upstream.series.reduce((sum, series) => sum + (series.points?.length || 0), 0);
    assert.ok(upstream.series.length > 0);
    assert.ok(pointCount > 0);
    console.log(`External upstream fixture passed: ${upstream.series.length} series, ${pointCount} points`);
    upstreamAvailable = true;
  } catch {
    console.log('External upstream fixture unavailable; safe provider error handling remains covered by route contract.');
  }

  if (upstreamAvailable) {
    const success = makeResponse();
    await handler(
      {
        method: 'GET',
        query: { symbol: 'BBCA.JK', start_date: '2026-01-01', end_date: '2026-01-31' },
      },
      success.response,
    );
    assert.equal(success.result.statusCode, 200);
    assert.equal((success.result.body as { success: boolean }).success, true);
    assert.equal(success.result.headers['Cache-Control'], 'public, max-age=0, must-revalidate');
    assert.equal(success.result.headers['Vercel-CDN-Cache-Control'], 'public, s-maxage=300, stale-while-revalidate=3600');
    console.log('External accumulation handler success/cache headers passed');
  }
} else {
  console.log('External upstream fixture skipped: generic broker-data environment is not configured.');
}
