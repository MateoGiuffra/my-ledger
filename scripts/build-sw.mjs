// Compila src/sw.ts → public/sw.js (Serwist). Next 16 usa Turbopack, donde @serwist/next no corre,
// así que el service worker se genera con esbuild antes de `next build`.
import { build } from "esbuild";

await build({
  entryPoints: ["src/sw.ts"],
  outfile: "public/sw.js",
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "info",
});
