import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, searchForWorkspaceRoot } from "vite";
import react from "@vitejs/plugin-react";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");

export default defineConfig({
  root: appDir,
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(repoRoot, "shared"),
    },
  },
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(repoRoot), repoRoot],
    },
  },
  build: {
    outDir: path.resolve(repoRoot, "dist/customer"),
    emptyOutDir: true,
  },
});
