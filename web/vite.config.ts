import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/dati-semantic-OpenCUP-LD/",
  build: {
    outDir: "../docs",
    emptyOutDir: true,
  },
});
