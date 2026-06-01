import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// ─── Mobile Viewport Height Fix ────────────────────────────────────────────
// Mobile browsers (Chrome/Android, Safari/iOS) have dynamic address bars
// that shrink/grow, making `100vh` unreliable. This sets --dvh to the actual
// VISIBLE viewport height using the Visual Viewport API.
function setViewportHeight() {
  const vh = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
  document.documentElement.style.setProperty("--dvh", `${vh}px`);
}
setViewportHeight();
window.visualViewport?.addEventListener("resize", setViewportHeight);
window.visualViewport?.addEventListener("scroll", setViewportHeight);
window.addEventListener("resize", setViewportHeight);
window.addEventListener("orientationchange", setViewportHeight);
// ───────────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
