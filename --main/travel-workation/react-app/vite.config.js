import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "/app/",
  plugins: [react()],
  build: {
    outDir: path.resolve("../react-dist"),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
      "/assets": "http://localhost:8080"
    }
  }
});
