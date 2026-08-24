import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const isVercel = process.env.VERCEL === "1";

export default defineConfig({
  base: isVercel ? "/" : "/app/",
  plugins: [react()],
  publicDir: path.resolve("../assets"),
  build: {
    outDir: isVercel ? "dist" : path.resolve("../react-dist"),
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
