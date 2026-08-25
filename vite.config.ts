import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const [repositoryOwner, repositoryName] = process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const isRootPagesRepository = Boolean(repositoryOwner && repositoryName === `${repositoryOwner}.github.io`);
const githubPagesBase = process.env.GITHUB_ACTIONS && repositoryName && !isRootPagesRepository ? `/${repositoryName}/` : "/";

const plugins = [
  react(),
  tailwindcss(),
  VitePWA({
    strategies: "injectManifest",
    srcDir: "src",
    filename: "firebase-messaging-sw.ts",
    registerType: "autoUpdate",
    includeAssets: ["hui-yue-title.svg"],
    manifest: {
      name: "繪月錄",
      short_name: "繪月錄",
      description: "繪月錄的離線優先委託管理工作台。",
      theme_color: "#355b48",
      background_color: "#faf7f2",
      display: "standalone",
      lang: "zh-Hant",
      icons: [{ src: "hui-yue-title.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }],
    },
    injectManifest: {
      globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
    },
    workbox: {
      navigateFallback: "index.html",
      globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
    },
  }),
];

export default defineConfig({
  plugins,
  base: githubPagesBase,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
