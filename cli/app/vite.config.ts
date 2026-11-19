import babel from "@rolldown/plugin-babel"
import react from "@vitejs/plugin-react"
import Icons from "unplugin-icons/vite"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  // Served at `/` by the docserve server, so assets resolve absolutely under
  // the internal prefix.
  base: "/__docserve/gallery/",
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  plugins: [
    react(),
    Icons({ compiler: "jsx", jsx: "react" }),
    babel({
      plugins: ["module:@preact/signals-react-transform"],
    }),
  ],
  build: {
    outDir: fileURLToPath(new URL("../dist/gallery", import.meta.url)),
    emptyOutDir: true,
    sourcemap: true,
  },
})