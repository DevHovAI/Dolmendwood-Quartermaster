import { defineConfig } from "vite";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "src/module.ts"),
      name: "dolmenwood-party-inventory",
      fileName: () => "module.js",
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "templates", dest: "." },
        { src: "lang", dest: "." },
        { src: "module.json", dest: "." },
      ],
    }),
  ],
});
