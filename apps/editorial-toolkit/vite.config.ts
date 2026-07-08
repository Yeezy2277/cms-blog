import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Contentful Hosting serves the bundle from a path that isn't the domain root,
// so a relative base keeps asset URLs correct inside the iframe.
export default defineConfig({
  base: "",
  plugins: [react()],
  server: {
    port: 3000,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
