import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyStoredTheme, setThemeMode } from "../../src";
import "../../src/styles/index.css";
import "./gallery.css";
import { App, THEME_KEY } from "./App";

// Before the first render (no inline script): stored mode, or ?theme= for screenshots.
const forced = new URLSearchParams(window.location.search).get("theme");
if (forced === "light" || forced === "dark") setThemeMode(THEME_KEY, forced);
else applyStoredTheme(THEME_KEY);

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
