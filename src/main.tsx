import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { bootstrapCloudAuthSession } from "@/lib/cloud-auth-session";
import { setupOnlineFlush } from "@/lib/sync-queue";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "./index.css";

bootstrapCloudAuthSession();
setupOnlineFlush();

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

async function startApp() {
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}

startApp();
