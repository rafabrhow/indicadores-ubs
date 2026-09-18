"use client";

import { useEffect } from "react";

export default function ServiceWorkerBrasil360() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("Erro ao registrar Service Worker:", error);
      });
    });
  }, []);

  return null;
}
