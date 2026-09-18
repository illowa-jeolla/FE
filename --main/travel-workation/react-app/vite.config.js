import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    outDir: path.resolve("../react-dist"),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    allowedHosts: ["localhost"],
    fs: {
      allow: [path.resolve("..")]
    },
    proxy: {
      "/api": {
        target: "https://api.illowa-jeolla.cloud",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      },
      "/assets": {
        target: "https://api.illowa-jeolla.cloud",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      },
      "/uploads": {
        target: "https://api.illowa-jeolla.cloud",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      },
      "/files": {
        target: "https://api.illowa-jeolla.cloud",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      },
      "/local-images": {
        target: "https://api.illowa-jeolla.cloud",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      }
    }
  }
});
