import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Em dev o proxy mantém front e API na mesma origem (cookie de refresh SameSite=Strict funciona).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": "http://localhost:3333" } },
});
