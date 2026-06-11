"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Spinner } from "@plus-experience/design-system/ui/spinner";
import { Button } from "@plus-experience/design-system/ui/button";
import { useLanguage } from "@/components/providers/language-provider";

// Baked into the bundle at build time (see next.config.ts). On Vercel this is
// the deploy's commit SHA; locally it's "dev" (update flow disabled).
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";

// Guards against a reload loop: if a reload didn't resolve the mismatch
// (e.g. a stale cache), we escalate to a hard cache purge, and only then fall
// back to a manual banner instead of looping.
//  - SOFT guard: a normal reg.update() + reload was already tried for version X.
//  - HARD guard: a full SW-unregister + cache-purge + reload was already tried.
const RELOAD_GUARD_KEY = "bn_update_reloaded_for";
const HARD_GUARD_KEY = "bn_update_hard_reset_for";

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === "string" ? data.version : null;
  } catch {
    return null; // offline / unreachable — stay on current version
  }
}

export function UpdateGate() {
  const { t } = useLanguage();
  const pathname = usePathname();
  // The /admin dashboard inspects deploy versions itself; an auto-reload here
  // would fight that. Skip the whole update flow on /admin.
  const isAdmin = pathname?.startsWith("/admin") ?? false;
  const [updating, setUpdating] = useState(false);
  const [bannerVersion, setBannerVersion] = useState<string | null>(null);
  const checkedInitial = useRef(false);

  const applyUpdate = useCallback(async (serverVersion: string) => {
    setUpdating(true);
    setBannerVersion(null);
    try {
      sessionStorage.setItem(RELOAD_GUARD_KEY, serverVersion);
    } catch {}
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      await reg?.update();
    } catch {}
    // Brief, intentional pause so the update reads as a real, official step
    // (network-first shell means the reload pulls the fresh build).
    setTimeout(() => window.location.reload(), 1200);
  }, []);

  // Escalation when a normal update reload didn't take: the running bundle is
  // still behind even after reg.update() + reload, which means a stale service
  // worker is serving old /_next/static chunks (cache-first). A new route's
  // chunk can be missing entirely → navigation to it fails. Cure: unregister
  // every SW and delete all caches, then reload from the network for a clean
  // build. IndexedDB (notes) and the auth session are NOT touched — this only
  // clears HTTP-level caches and only runs online with a confirmed mismatch.
  const hardReset = useCallback(async (serverVersion: string) => {
    setUpdating(true);
    setBannerVersion(null);
    try {
      sessionStorage.setItem(HARD_GUARD_KEY, serverVersion);
    } catch {}
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {}
    setTimeout(() => window.location.reload(), 1200);
  }, []);

  // Initial entry: if this bundle is behind the live deploy, auto-apply with a
  // full-screen "updating" screen.
  useEffect(() => {
    if (isAdmin) return;
    if (APP_VERSION === "dev") return;
    if (checkedInitial.current) return;
    checkedInitial.current = true;

    (async () => {
      const serverVersion = await fetchServerVersion();
      if (!serverVersion || serverVersion === APP_VERSION) return;
      let softTried = false;
      let hardTried = false;
      try {
        softTried = sessionStorage.getItem(RELOAD_GUARD_KEY) === serverVersion;
        hardTried = sessionStorage.getItem(HARD_GUARD_KEY) === serverVersion;
      } catch {}
      // First pass: normal SW update + reload. Second pass (soft didn't take):
      // hard cache purge. Third pass (still stuck): manual banner — don't loop.
      if (!softTried) {
        applyUpdate(serverVersion);
      } else if (!hardTried) {
        hardReset(serverVersion);
      } else {
        setBannerVersion(serverVersion);
      }
    })();
  }, [applyUpdate, hardReset, isAdmin]);

  // Re-check when the app regains focus (PWA kept open across a deploy).
  // Mid-use we show a non-intrusive banner rather than reloading abruptly.
  useEffect(() => {
    if (isAdmin) return;
    if (APP_VERSION === "dev") return;
    const onVisible = async () => {
      if (document.visibilityState !== "visible") return;
      if (updating || bannerVersion) return;
      const serverVersion = await fetchServerVersion();
      if (serverVersion && serverVersion !== APP_VERSION) {
        setBannerVersion(serverVersion);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [updating, bannerVersion, isAdmin]);

  if (isAdmin) return null;

  if (updating) {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background">
        <span
          className="flex size-14 items-center justify-center rounded-2xl bg-foreground text-3xl font-bold text-background"
          aria-hidden
        >
          b
        </span>
        <Spinner className="h-6 w-6 text-muted-foreground" />
        <div className="text-center">
          <p className="text-base font-medium tracking-tight">{t("update.updating")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("update.subtitle")}</p>
        </div>
      </div>
    );
  }

  if (bannerVersion) {
    return (
      <div className="fixed inset-x-0 bottom-5 z-[100] flex justify-center px-4">
        <div className="flex items-center gap-4 rounded-2xl bg-card px-5 py-3 text-card-foreground shadow-lg shadow-black/10 dark:shadow-black/40">
          <span className="text-sm font-medium">{t("update.available")}</span>
          <Button
            size="sm"
            onClick={() => {
              // If a soft reload was already tried for this version, the cache
              // is stuck — go straight to the hard purge. Otherwise the gentle
              // path covers normal updates without re-downloading everything.
              let softTried = false;
              try {
                softTried =
                  sessionStorage.getItem(RELOAD_GUARD_KEY) === bannerVersion;
              } catch {}
              if (softTried) hardReset(bannerVersion);
              else applyUpdate(bannerVersion);
            }}
          >
            {t("update.refresh")}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
