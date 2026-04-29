import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";
import { stopAutoSync } from "@/lib/sync/engine";

export const RESET_PENDING_KEY = "bn_reset_pending";
export const LAST_SYNC_KEY = "securenote_last_sync";

/**
 * Permanently wipes all local and remote data, unregisters service workers,
 * clears browser storage, then reloads the app. Irreversible.
 *
 * If remote delete fails (e.g., RLS), we still wipe locally and set a cutoff
 * so subsequent syncs ignore pre-reset entities.
 */
export async function resetEverything() {
  stopAutoSync();

  // Tell sibling tabs to drop their in-memory cryptoKey before we wipe data,
  // otherwise they keep encrypting with a stale master key.
  try {
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel("bn_crypto");
      bc.postMessage({ type: "reset" });
      bc.close();
    }
  } catch {}

  let remoteWipeOk = true;

  try {
    const { error: e1 } = await supabase
      .from("encrypted_entities")
      .delete()
      .neq("id", "___never___");
    if (e1) {
      console.error("[reset] entities delete failed:", e1);
      remoteWipeOk = false;
    }
  } catch (e) {
    console.error("[reset] entities delete threw:", e);
    remoteWipeOk = false;
  }

  try {
    const { error: e2 } = await supabase
      .from("app_settings")
      .delete()
      .neq("id", "___never___");
    if (e2) {
      console.error("[reset] settings delete failed:", e2);
      remoteWipeOk = false;
    }
  } catch (e) {
    console.error("[reset] settings delete threw:", e);
    remoteWipeOk = false;
  }

  await db.transaction(
    "rw",
    db.categories,
    db.notes,
    db.settings,
    async () => {
      await db.categories.clear();
      await db.notes.clear();
      await db.settings.clear();
    }
  );

  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {}

  // Mark as a fresh reset so CryptoProvider skips remote settings pull,
  // and advance sync cursor so pre-reset entities won't be pulled back.
  try {
    localStorage.setItem(RESET_PENDING_KEY, "1");
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
    if (!remoteWipeOk) localStorage.setItem("bn_reset_remote_failed", "1");
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

  location.reload();
}
