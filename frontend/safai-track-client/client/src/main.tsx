// River Delta / Responsive Light — global font loading and motion-aware app bootstrap.
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
import Lenis from "lenis";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

function MotionRoot() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true });
    let frame = 0;
    const raf = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(raf); };
    frame = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(frame); lenis.destroy(); };
  }, []);
  return <QueryClientProvider client={queryClient}><App /><Toaster position="bottom-right" toastOptions={{ style: { background: "#103b3c", color: "#fff", border: "1px solid rgba(200,240,74,.35)", fontFamily: "Space Grotesk" } }} /></QueryClientProvider>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><MotionRoot /></React.StrictMode>);
