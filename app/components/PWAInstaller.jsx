"use client";

import { useEffect } from "react";

export default function PWAInstaller() {
  useEffect(() => {
    const isProd = process.env.NODE_ENV === "production";

    async function clearAllCaches() {
      try {
        if (typeof caches !== "undefined") {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
      } catch (_) {}
    }

    if (!("serviceWorker" in navigator)) return;

    if (!isProd) {
      // In development, unregister any SW and clear caches to avoid confusing state
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      clearAllCaches();
      return;
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          type: "classic",
          updateViaCache: "none",
        });

        // If an update is found, tell it to activate immediately
        reg.addEventListener("updatefound", () => {
          const newSW = reg.installing;
          if (!newSW) return;
          newSW.addEventListener("statechange", () => {
            if (newSW.state === "installed") {
              // If there is already a controller, this is an update
              if (navigator.serviceWorker.controller) {
                reg.waiting?.postMessage("SKIP_WAITING");
              }
            }
          });
        });

        // Also try to trigger an update check on load
        reg.update().catch(() => {});
      } catch (_) {}
    })();
  }, []);

  return null;
}
