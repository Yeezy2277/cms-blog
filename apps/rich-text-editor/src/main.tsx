import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GlobalStyles } from "@contentful/f36-components";
import { SDKProvider } from "@contentful/react-apps-toolkit";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SDKProvider>
      <GlobalStyles />
      <App />
    </SDKProvider>
  </StrictMode>,
);
