import path from "path"
import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "")
  const proxyTarget = env.VITE_PROXY_TARGET?.trim() || "http://localhost:8000"

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      watch: {
        usePolling: true,
      },
      hmr: {
        clientPort: 5173,
      },
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          ws: true,
        },
        "/static": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          entryFileNames: "assets/[name]-[hash].js",
          chunkFileNames: "assets/[name]-[hash].js",
          assetFileNames: "assets/[name]-[hash].[ext]",
          manualChunks(id) {
            if (!id.includes("node_modules")) return
            if (id.includes("react-pdf") || id.includes("@react-pdf")) return "vendor-pdf"
            if (id.includes("@uiw/react-md-editor") || id.includes("remark-") || id.includes("rehype-") || id.includes("micromark")) return "vendor-editor"
            if (id.includes("@dnd-kit")) return "vendor-dnd"
            if (id.includes("@tanstack/react-query") || id.includes("axios")) return "vendor-data"
            if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts"
            if (id.includes("@radix-ui") || id.includes("framer-motion") || id.includes("lucide-react") || id.includes("sonner")) return "vendor-ui"
            if (id.includes("react-router") || id.includes("react-dom") || id.includes("/react/")) return "vendor-react"
          },
        },
      },
    },
  }
})
