import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { isResizeObserverLoopWarning } from "./lib/browserError";
import "./index.css";

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

const suppressResizeObserverLoop = (event: ErrorEvent) => {
  const message = event.message || (event.error instanceof Error ? event.error.message : undefined);
  if (isResizeObserverLoopWarning(message)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
  }
  return false;
};

const previousWindowError = window.onerror;
window.onerror = (message, source, line, column, error) => {
  if (isResizeObserverLoopWarning(typeof message === "string" ? message : error?.message)) return true;
  return previousWindowError?.call(window, message, source, line, column, error) ?? false;
};

document.addEventListener("error", suppressResizeObserverLoop, true);
window.addEventListener("error", suppressResizeObserverLoop, true);

createRoot(document.getElementById("root")!).render(<App />);
