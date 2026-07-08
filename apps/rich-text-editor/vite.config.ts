import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `host: true` + HTTPS client port lets you expose the dev server through an
// ngrok tunnel so Contentful can load it in the field iframe during local dev.
export default defineConfig({
  base: "",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    hmr: { clientPort: 443 },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
