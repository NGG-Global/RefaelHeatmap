/**
 * Plain-fetch client for PostgREST RPC (`POST /rest/v1/rpc/<fn>`).
 * Used on every route; the participant route uses nothing else, which keeps it
 * free of supabase-js.
 */
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";

export type RpcFailure = "network" | "timeout" | "http";

export class RpcError extends Error {
  readonly kind: RpcFailure;
  readonly httpStatus?: number;

  constructor(kind: RpcFailure, message: string, httpStatus?: number) {
    super(message);
    this.name = "RpcError";
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}

export interface RpcOptions {
  /** Abort a single attempt after this many milliseconds. */
  timeoutMs?: number;
  /** Extra attempts after a network error, timeout or 5xx. Only for idempotent calls. */
  retries?: number;
}

const RETRY_DELAYS_MS = [800, 2000, 4000];

function headers(): HeadersInit {
  const h: Record<string, string> = {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    "Content-Type": "application/json",
  };
  // New-style keys (sb_publishable_…) go in `apikey` only. A legacy anon key is
  // a JWT and is also sent as the bearer token.
  if (!SUPABASE_PUBLISHABLE_KEY.startsWith("sb_")) {
    h.Authorization = `Bearer ${SUPABASE_PUBLISHABLE_KEY}`;
  }
  return h;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attempt<T>(fn: string, args: object, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(args),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = controller.signal.aborted;
    throw new RpcError(timedOut ? "timeout" : "network", timedOut ? "request timed out" : String(error));
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new RpcError("http", `${fn} failed with HTTP ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

function retryable(error: unknown): boolean {
  if (!(error instanceof RpcError)) return false;
  if (error.kind !== "http") return true;
  return error.httpStatus !== undefined && (error.httpStatus >= 500 || error.httpStatus === 429);
}

export async function rpc<T>(fn: string, args: object, options: RpcOptions = {}): Promise<T> {
  const { timeoutMs = 10_000, retries = 0 } = options;
  for (let i = 0; ; i++) {
    try {
      return await attempt<T>(fn, args, timeoutMs);
    } catch (error) {
      if (i >= retries || !retryable(error)) throw error;
      await sleep(RETRY_DELAYS_MS[Math.min(i, RETRY_DELAYS_MS.length - 1)]);
    }
  }
}
