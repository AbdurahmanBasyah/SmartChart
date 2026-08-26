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
  headers?: Record<string, string | string[] | undefined>;
  protocol?: string;
  get?: (name: string) => string | undefined;
  url?: string;
};

export function getHeader(req: RequestLike, name: string): string | undefined {
  const expected = name.toLowerCase();
  const headers = req.headers ?? {};
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === expected)?.[1];
  if (Array.isArray(found)) return found[0];
  if (typeof found === "string") return found;
  return req.get?.(name) ?? req.get?.(name.toLowerCase());
}

export function getRawRequestBody(req: RequestLike): string {
  if (typeof req.body === "string") return req.body;
  if (req.body == null) return "";
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(req.body)) {
    return req.body.toString("utf8");
  }
  return JSON.stringify(req.body);
}

export function parseRequestBody<T>(rawBody: string): T {
  if (!rawBody.trim()) return {} as T;
  return JSON.parse(rawBody) as T;
}

export type QStashVerification = {
  ok: boolean;
  status: 401 | 503;
  code: "MISSING_QSTASH_SIGNATURE" | "INVALID_QSTASH_SIGNATURE" | "QSTASH_KEYS_NOT_CONFIGURED";
};

export async function verifyQstashRequest(
  req: RequestLike,
  rawBody = getRawRequestBody(req),
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
    const receiver = new Receiver({ currentSigningKey, nextSigningKey });
    await receiver.verify({ body: rawBody, signature });
    return { ok: true, status: 401, code: "INVALID_QSTASH_SIGNATURE" };
  } catch {
    return { ok: false, status: 401, code: "INVALID_QSTASH_SIGNATURE" };
  }
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
