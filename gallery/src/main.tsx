import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { applyStoredTheme, setThemeMode } from "../../src";
import "../../src/styles/index.css";
import "./gallery.css";
import { App, THEME_KEY } from "./App";
import { applyStoredStyle, setGalleryStyle } from "./style";

// Before the first render (no inline script): the stored theme and style, or
// ?theme= and ?style= for screenshots.
const search = new URLSearchParams(window.location.search);
const forced = search.get("theme");
if (forced === "light" || forced === "dark") setThemeMode(THEME_KEY, forced);
else applyStoredTheme(THEME_KEY);
const style = search.get("style");
if (style === "default" || style === "quiet") setGalleryStyle(style);
else applyStoredStyle();

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
