import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { GlobalStyles } from "@contentful/f36-components";
import { SDKProvider } from "@contentful/react-apps-toolkit";
import App from "./App";
import { StandaloneDemo } from "./StandaloneDemo";

// Contentful always loads apps inside an iframe — but so does the portfolio
// hub's preview modal. An iframe check alone can't tell them apart, so the
// playground is forced explicitly with `?demo=1` (the hub embeds that URL).
// Direct opens (no iframe) also get the playground.
const inIframe = typeof window !== "undefined" && window.self !== window.top;
const demoForced = new URLSearchParams(window.location.search).has("demo");
const inContentful = inIframe && !demoForced;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {inContentful ? (
      <SDKProvider>
        <GlobalStyles />
        <App />
      </SDKProvider>
    ) : (
      <StandaloneDemo />
    )}
  </StrictMode>,
);
