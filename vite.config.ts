import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: "index.html",
        background: "src/background.ts",
        content: "src/content.ts",
      },
      output: {
        entryFileNames: (chunk) => chunk.name === "background" || chunk.name === "content"
          ? "[name].js"
          : "assets/[name]-[hash].js",
      },
    },
  },
});
