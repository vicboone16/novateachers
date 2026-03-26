import { createRoot } from "react-dom/client";
import { bootstrapCloudAuthSession } from "@/lib/cloud-auth-session";
import "./index.css";

bootstrapCloudAuthSession();

async function startApp() {
  const { default: App } = await import("./App.tsx");
  createRoot(document.getElementById("root")!).render(<App />);
}

startApp();
