import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Vite writes VITE_* variables into the bundle at build time. A build without
 * them deploys a site that cannot reach the database, so stop the build
 * instead, and say which similar variable names were present (names only,
 * never values). Also refuse a secret / service-role key: it would ship to
 * every browser.
 */
function requireSupabaseEnv(): Plugin {
  return {
    name: "ngg-require-supabase-env",
    apply: "build",
    configResolved(config) {
      const read = (name: string) => String(config.env[name] ?? process.env[name] ?? "").trim();
      const url = read("VITE_SUPABASE_URL");
      const key = read("VITE_SUPABASE_PUBLISHABLE_KEY");
      const problems: string[] = [];

      if (!url) problems.push("VITE_SUPABASE_URL is not set.");
      else if (!/^https:\/\/[^/\s]+$/.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))
        problems.push("VITE_SUPABASE_URL must look like https://<project-ref>.supabase.co (no path).");

      if (!key) problems.push("VITE_SUPABASE_PUBLISHABLE_KEY is not set.");
      else if (key.startsWith("sb_secret_") || jwtRole(key) === "service_role")
        problems.push("VITE_SUPABASE_PUBLISHABLE_KEY holds a SECRET key. Use the publishable (anon) key; rotate the secret key if it was exposed.");
      else if (!key.startsWith("sb_publishable_") && jwtRole(key) !== "anon")
        problems.push("VITE_SUPABASE_PUBLISHABLE_KEY is not a publishable key (expected sb_publishable_… or the legacy anon key).");

      if (problems.length === 0) return;

      const similar = Object.keys(process.env)
        .filter((n) => /SUPABASE|PUBLISHABLE|ANON_KEY|PUBLIC_BASE_URL/i.test(n))
        .map((n) => JSON.stringify(n));
      const vercelEnv = process.env.VERCEL_ENV ? ` (Vercel environment: ${process.env.VERCEL_ENV})` : "";
      throw new Error(
        [
          `Build stopped: Supabase settings are missing or wrong${vercelEnv}.`,
          ...problems.map((p) => `  - ${p}`),
          `  Similar variable names present in this build: ${similar.length ? similar.join(", ") : "none"}.`,
          "  Fix: Vercel → Settings → Environment Variables, exact names VITE_SUPABASE_URL and",
          "  VITE_SUPABASE_PUBLISHABLE_KEY, ticked for this environment; then redeploy.",
        ].join("\n"),
      );
    },
  };
}

/** The `role` claim of a legacy JWT key, or null. */
function jwtRole(key: string): string | null {
  const parts = key.split(".");
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")).role ?? null;
  } catch {
    return null;
  }
}

/**
 * Participants arrive on weak cellular data. The participant route is lazy, so
 * without help the browser would fetch the entry chunk, run it, and only then
 * request the route chunk: one extra round trip. This plugin adds
 * <link rel="modulepreload"> / <link rel="preload" as="style"> for the route
 * chunk to index.html so both download in parallel. Plain tags, no inline
 * script, so the Content-Security-Policy stays strict.
 */
function preloadParticipantRoute(): Plugin {
  return {
    name: "ngg-preload-participant-route",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const chunks = Object.values(ctx.bundle ?? {});
        const route = chunks.find(
          (c) => c.type === "chunk" && c.facadeModuleId?.endsWith("/participant/ParticipantPage.tsx"),
        );
        if (!route || route.type !== "chunk") return;
        const entry = chunks.find((c) => c.type === "chunk" && c.isEntry);
        const tags: HtmlTagDescriptor[] = [];
        for (const file of [route.fileName, ...route.imports]) {
          if (entry && file === entry.fileName) continue;
          tags.push({ tag: "link", attrs: { rel: "modulepreload", crossorigin: true, href: `/${file}` }, injectTo: "head" });
        }
        for (const css of route.viteMetadata?.importedCss ?? []) {
          tags.push({ tag: "link", attrs: { rel: "preload", as: "style", href: `/${css}` }, injectTo: "head" });
        }
        return tags;
      },
    },
  };
}

export default defineConfig({
  plugins: [requireSupabaseEnv(), react(), preloadParticipantRoute()],
  build: {
    // Older iPhones in the room: keep syntax Safari 14 can run.
    target: ["es2020", "safari14", "chrome87", "edge88"],
    manifest: true,
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  server: { host: true },
});
