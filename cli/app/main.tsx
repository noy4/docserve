import { createRoot } from "react-dom/client"
import { App } from "./App.js"
import "./app.css"

const host = document.getElementById("app")
if (!host) throw new Error("#app is missing")

createRoot(host).render(<App />)