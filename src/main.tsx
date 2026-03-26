import { createRoot } from "react-dom/client";
import { bootstrapCloudAuthSession } from "@/lib/cloud-auth-session";
import App from "./App.tsx";
import "./index.css";

bootstrapCloudAuthSession();

createRoot(document.getElementById("root")!).render(<App />);
