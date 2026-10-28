/** Shared helpers for the seed and load scripts. */
import { existsSync, readFileSync } from "node:fs";

export interface Config {
  url: string;
  key: string;
}

/** VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY from the environment or .env.local. */
export function loadConfig(): Config {
  const file: Record<string, string> = {};
  if (existsSync(".env.local")) {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) file[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  const url = (process.env.VITE_SUPABASE_URL ?? file.VITE_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? file.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!url || !key) {
    console.error("Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (in .env.local or the environment).");
    process.exit(2);
  }
  return { url, key };
}

/** Calls a public RPC exactly as the browser does: publishable key only. */
export function rpcClient({ url, key }: Config) {
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (!key.startsWith("sb_")) headers.Authorization = `Bearer ${key}`;
  return async function rpc<T = Record<string, unknown>>(fn: string, args: object): Promise<T> {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
    if (!res.ok) throw new Error(`${fn}: HTTP ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };
}

/** Host PIN from a hidden prompt (or HOST_PIN for unattended local runs). */
export async function readPin(): Promise<string> {
  if (process.env.HOST_PIN) return process.env.HOST_PIN;
  const stdin = process.stdin;
  if (!stdin.isTTY) {
    console.error("Run interactively to type the host PIN, or set HOST_PIN for an unattended local run.");
    process.exit(2);
  }
  process.stdout.write("Host PIN: ");
  return new Promise((resolve) => {
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") process.exit(130);
        if (ch === "\r" || ch === "\n") {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off("data", onData);
          process.stdout.write("\n");
          resolve(value);
          return;
        }
        value = ch === "\u007f" || ch === "\b" ? value.slice(0, -1) : value + ch;
      }
    };
    stdin.on("data", onData);
  });
}

/** Minimal assertion log: every check is printed; failures make the script exit 1. */
export function checker() {
  let failed = 0;
  return {
    check(ok: boolean, label: string, detail?: unknown) {
      console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail !== undefined && !ok ? `  → ${JSON.stringify(detail)}` : ""}`);
      if (!ok) failed++;
    },
    get failed() {
      return failed;
    },
  };
}
