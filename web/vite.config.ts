import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser only talks to this dev server. /api and /static are proxied to
// the Python app so the session cookie stays on one origin.
const proxy = {
  "/api": "http://127.0.0.1:8765",
  "/static": "http://127.0.0.1:8765",
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy,
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    proxy,
  },
});
