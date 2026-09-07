import { StrictMode, useEffect, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "bootstrap-italia/dist/css/bootstrap-italia.min.css";
import "./index.css";

function BootstrapItaliaInit({ children }: { children: ReactNode }) {
  useEffect(() => {
    void import("bootstrap-italia/dist/js/bootstrap-italia.bundle.min.js");
  }, []);
  return children;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BootstrapItaliaInit>
      <App />
    </BootstrapItaliaInit>
  </StrictMode>
);
