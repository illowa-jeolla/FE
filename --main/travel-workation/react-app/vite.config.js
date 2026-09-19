import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

const backendOrigin = "https://api.illowa-jeolla.cloud";
const proxyOptions = {
  target: backendOrigin,
  changeOrigin: true,
  secure: true,
  headers: { Origin: "https://illowa-jeolla.cloud" },
  cookieDomainRewrite: ""
};

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
      "/api": { ...proxyOptions },
      "/assets": { ...proxyOptions },
      "/uploads": { ...proxyOptions },
      "/files": { ...proxyOptions },
      "/local-images": { ...proxyOptions }
    }
  }
});
