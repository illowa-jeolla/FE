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
        target: "http://illowa-jeolla-main-alb-778055198.ap-northeast-2.elb.amazonaws.com",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      },
      "/assets": {
        target: "http://illowa-jeolla-main-alb-778055198.ap-northeast-2.elb.amazonaws.com",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      },
      "/uploads": {
        target: "http://illowa-jeolla-main-alb-778055198.ap-northeast-2.elb.amazonaws.com",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      },
      "/files": {
        target: "http://illowa-jeolla-main-alb-778055198.ap-northeast-2.elb.amazonaws.com",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      },
      "/local-images": {
        target: "http://illowa-jeolla-main-alb-778055198.ap-northeast-2.elb.amazonaws.com",
        changeOrigin: true,
        secure: true,
        headers: {
        }
      }
    }
  }
});
