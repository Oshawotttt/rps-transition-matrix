import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { relayPlugin } from "./server/relay.js";

// Relative base so the built app works from any folder the local server serves it from.
// relayPlugin() adds the /api/ relay to the dev and preview servers.
export default defineConfig({ plugins: [react(), relayPlugin()], base: "./" });
