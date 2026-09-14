import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "pwa-192.png", "pwa-512.png", "icons/icon-180x180.png"],
      manifest: {
        name: "NovaTrack Teacher Hub",
        short_name: "NovaTrack",
        description: "Quick Add data entry, trigger tracking, and IEP tools for teachers",
        theme_color: "#2563eb",
        background_color: "#f8fafc",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/classroom",
        icons: [
          { src: "icons/icon-192.png",   sizes: "192x192",  type: "image/png" },
          { src: "icons/icon.png",        sizes: "512x512",  type: "image/png", purpose: "any maskable" },
          { src: "icons/icon-180x180.png",sizes: "180x180",  type: "image/png" },
          { src: "icons/icon-152x152.png",sizes: "152x152",  type: "image/png" },
          { src: "icons/icon-120x120.png",sizes: "120x120",  type: "image/png" },
        ],
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/~oauth/],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/yboqqmkghwhlhhnsegje\.supabase\.co\/rest\/v1\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 300,
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
