import babel from "@rolldown/plugin-babel"
import react from "@vitejs/plugin-react"
import Icons from "unplugin-icons/vite"
import { defineConfig } from "vite"

export default defineConfig({
  // Lib mode leaves process.env for consumers; define it so React bundles its production build.
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  plugins: [
    react(),
    // Iconify icons inlined at build time; `?raw` imports stay plain SVG strings.
    Icons({ compiler: "jsx", jsx: "react" }),
    babel({
      plugins: ["module:@preact/signals-react-transform"],
    }),
  ],
  build: {
    outDir: "dist/widget",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: "src/widget/index.js",
      formats: ["es"],
      fileName: () => "index.js",
    },
  },
})
