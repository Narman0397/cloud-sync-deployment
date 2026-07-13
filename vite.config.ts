// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tslibEsm = require.resolve("tslib/tslib.es6.mjs");

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    resolve: {
      alias: [
        // Force tslib to its proper ESM build. The default "node" export
        // condition resolves to modules/index.js which does
        //   `import tslib from '../tslib.js'; const { __extends } = tslib;`
        // On Cloudflare Workers / esbuild interop, tslib.js is CJS and
        // `.default` is undefined → runtime error:
        // "Cannot destructure property '__extends' of '__toESM(...).default'".
        // Using tslib.es6.mjs exposes the helpers as real named ESM exports.
        { find: /^tslib$/, replacement: "tslib/tslib.es6.mjs" },
      ],
    },
    plugins: [
      VitePWA({
        strategies: "injectManifest",
        srcDir: "public",
        filename: "sw.js",
        injectRegister: null,
        registerType: "autoUpdate",
        devOptions: { enabled: false },
        manifest: false, // pakai public/manifest.webmanifest
        injectManifest: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,webp,woff2}"],
          globIgnores: ["**/service-worker.js"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        },
      }),
    ],
  },
});
