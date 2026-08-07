import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { installGlobalRuntimeLogging, logger } from "./app/logger";
import { RuntimeErrorBoundary } from "./components/RuntimeErrorBoundary";
import "./styles.css";

installGlobalRuntimeLogging();

const rootElement = document.getElementById("root");

if (!rootElement) {
  const rootError = new Error("JØNEX root element was not found.");
  void logger.error("Frontend bootstrap failed", rootError);
  throw rootError;
}

void logger.info("Mounting JØNEX React shell");

createRoot(rootElement).render(
  <StrictMode>
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>
  </StrictMode>,
);