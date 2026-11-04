import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the built app works from any folder the local server serves it from.
export default defineConfig({ plugins: [react()], base: "./" });
