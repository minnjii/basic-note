"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/providers/language-provider";

// Shown once after the service worker finishes precaching the shell + editor
// route (it postMessages "offline-ready"). This is the signal that going
// offline is now safe — first-run users who go offline before this fires hit
// the "note entry breaks after a couple notes" race. Guarded to show once.
const SHOWN_KEY = "bn_offline_ready_shown";

export function OfflineReadyToast() {
  const { t } = useLanguage();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (e: MessageEvent) => {
      if (e.data?.type !== "offline-ready") return;
      try {
        if (localStorage.getItem(SHOWN_KEY)) return;
        localStorage.setItem(SHOWN_KEY, "1");
      } catch {
        // private mode / storage blocked — still show, just don't dedupe
      }
      toast.success(t("offline.ready"));
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () =>
      navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [t]);

  return null;
}
