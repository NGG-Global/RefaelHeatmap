import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

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
  plugins: [react(), preloadParticipantRoute()],
  build: {
    // Older iPhones in the room: keep syntax Safari 14 can run.
    target: ["es2020", "safari14", "chrome87", "edge88"],
    manifest: true,
    sourcemap: false,
    assetsInlineLimit: 0,
  },
  server: { host: true },
});
