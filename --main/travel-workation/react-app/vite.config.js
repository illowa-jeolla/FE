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
    allowedHosts: ["rearview-sugar-botanist.ngrok-free.dev"],
    fs: {
      allow: [path.resolve("..")]
    },
    proxy: {
      "/api": {
        target: "https://lia-balsamiferous-elois.ngrok-free.dev",
        changeOrigin: true,
        secure: true,
        headers: {
          "ngrok-skip-browser-warning": "1"
        }
      },
      "/assets": "http://localhost:8080"
    }
  }
});
