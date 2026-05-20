import { supabase } from "@/lib/supabase";
import { db } from "@/lib/db";
import type { Category, Note, AppSettings } from "@/lib/types";

type EntityType = "category" | "note";

/**
 * Dev builds share the same Supabase project as production, which means any
 * entity pushed from dev leaks into prod as undecryptable "복호화 실패" items.
 * Gate all sync calls so they only run in production unless explicitly enabled.
 */
const SYNC_ENABLED =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_ENABLE_SYNC === "true";

interface EncryptedEntity {
  id: string;
  entity_type: EntityType;
  data: string; // JSON string (fields already encrypted)
  updated_at: number;
  deleted: boolean;
}

// ─── Push: Local → Supabase ──────────────────────────────────

async function pushEntity(
  entityType: EntityType,
  entity: Category | Note
) {
  const { id, ...rest } = entity;
  const row: EncryptedEntity = {
    id,
    entity_type: entityType,
    data: JSON.stringify(rest),
    updated_at: entity.updatedAt,
    deleted: !!entity.deletedAt,
  };

  const { error } = await supabase
    .from("encrypted_entities")
    .upsert(row, { onConflict: "id" });

  if (error) console.error(`[sync] push ${entityType}/${id} failed:`, error);
}

async function pushSettings(settings: AppSettings) {
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        id: settings.id,
        data: JSON.stringify(settings),
        updated_at: settings.updatedAt,
      },
      { onConflict: "id" }
    );

  if (error) console.error("[sync] push settings failed:", error);
}

// ─── Pull: Supabase → Local ─────────────────────────────────

async function pullAll(lastSyncAt: number) {
  const { data: entities, error } = await supabase
    .from("encrypted_entities")
    .select("*")
    .gt("updated_at", lastSyncAt)
    .order("updated_at", { ascending: true });

  if (error) {
    console.error("[sync] pull entities failed:", error);
    return 0;
  }

  if (!entities || entities.length === 0) return 0;

  let count = 0;

  for (const row of entities as EncryptedEntity[]) {
    const parsed = JSON.parse(row.data);
    const entity = { id: row.id, ...parsed };

    try {
      switch (row.entity_type) {
        case "category": {
          const existing = await db.categories.get(row.id);
          if (!existing || existing.updatedAt < row.updated_at) {
            await db.categories.put(entity as Category);
            count++;
          }
          break;
        }
        case "note": {
          const existing = await db.notes.get(row.id);
          if (!existing || existing.updatedAt < row.updated_at) {
            await db.notes.put(entity as Note);
            count++;
          }
          break;
        }
      }
    } catch (e) {
      console.error(`[sync] pull apply ${row.entity_type}/${row.id} failed:`, e);
    }
  }

  return count;
}

async function pullSettings(): Promise<AppSettings | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", "settings")
    .single();

  if (error || !data) return null;
  return JSON.parse(data.data) as AppSettings;
}

// ─── Full Sync ───────────────────────────────────────────────

const LAST_SYNC_KEY = "securenote_last_sync";

function getLastSyncAt(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem(LAST_SYNC_KEY) ?? "0", 10);
}

function setLastSyncAt(ts: number) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_SYNC_KEY, ts.toString());
  }
}

export async function syncPush() {
  if (!SYNC_ENABLED) return;
  if (!navigator.onLine) return;

  try {
    // Push settings
    const settings = await db.settings.get("settings");
    if (settings) await pushSettings(settings);

    // Push all categories
    const categories = await db.categories.toArray();
    for (const cat of categories) {
      await pushEntity("category", cat);
    }

    // Push all notes
    const notes = await db.notes.toArray();
    for (const note of notes) {
      await pushEntity("note", note);
    }

    setLastSyncAt(Date.now());
  } catch (e) {
    console.error("[sync] push failed:", e);
  }
}

export async function syncPull() {
  if (!SYNC_ENABLED) return;
  if (!navigator.onLine) return;

  try {
    const lastSync = getLastSyncAt();
    const count = await pullAll(lastSync);
    if (count > 0) {
      setLastSyncAt(Date.now());
    }
  } catch (e) {
    console.error("[sync] pull failed:", e);
  }
}

export async function syncPullSettings(): Promise<AppSettings | null> {
  if (!SYNC_ENABLED) return null;
  if (!navigator.onLine) return null;
  return pullSettings();
}

/**
 * Quick existence check for non-deleted entities (notes or categories) on
 * Supabase. Used by bootstrap to detect "new install but server already has
 * data" — typically iOS PWA storage partitioning, where the standalone
 * instance has an empty IDB but the same Supabase project still holds the
 * user's encrypted data. Setup must be blocked in that state, otherwise a
 * fresh master key would be pushed and the existing ciphertext becomes
 * permanently undecryptable.
 *
 * Returns false on any error/offline so callers fall back to permissive
 * behavior — we only want to *block* on a confident positive.
 */
export async function hasRemoteEntities(): Promise<boolean> {
  if (!SYNC_ENABLED) return false;
  if (typeof navigator !== "undefined" && !navigator.onLine) return false;
  try {
    const { count, error } = await supabase
      .from("encrypted_entities")
      .select("id", { count: "exact", head: true })
      .eq("deleted", false)
      .limit(1);
    if (error) {
      console.error("[sync] hasRemoteEntities failed:", error);
      return false;
    }
    return (count ?? 0) > 0;
  } catch (e) {
    console.error("[sync] hasRemoteEntities threw:", e);
    return false;
  }
}

// ─── Push Single Entity (incremental) ────────────────────────

export async function syncPushEntity(
  entityType: EntityType,
  entity: Category | Note
) {
  if (!SYNC_ENABLED) return;
  if (!navigator.onLine) return;
  try {
    await pushEntity(entityType, entity);
  } catch (e) {
    console.error(`[sync] incremental push ${entityType} failed:`, e);
  }
}

export async function syncPushSettings() {
  if (!SYNC_ENABLED) return;
  if (!navigator.onLine) return;
  try {
    const settings = await db.settings.get("settings");
    if (settings) await pushSettings(settings);
  } catch (e) {
    console.error("[sync] push settings failed:", e);
  }
}

// ─── Realtime Subscription ────────────────────────────────────

let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let syncInterval: ReturnType<typeof setInterval> | null = null;

async function handleRealtimeChange(payload: {
  eventType: string;
  new: Record<string, unknown>;
}) {
  const row = payload.new as unknown as EncryptedEntity;
  if (!row || !row.id) return;

  // Skip rows from before the last successful sync. resetEverything() advances
  // LAST_SYNC_KEY to Date.now() so pre-reset ciphertext (encrypted under the
  // previous master key) cannot leak back in via realtime events.
  if (row.updated_at <= getLastSyncAt()) return;

  const parsed = JSON.parse(row.data as string);
  const entity = { id: row.id, ...parsed };

  try {
    switch (row.entity_type) {
      case "category": {
        const existing = await db.categories.get(row.id);
        if (!existing || existing.updatedAt < row.updated_at) {
          await db.categories.put(entity as Category);
        }
        break;
      }
      case "note": {
        const existing = await db.notes.get(row.id);
        if (!existing || existing.updatedAt < row.updated_at) {
          await db.notes.put(entity as Note);
        }
        break;
      }
    }
  } catch (e) {
    console.error(`[sync] realtime apply failed:`, e);
  }
}

// Mirror remote app_settings changes into IDB. Used so a password change on
// one device propagates to others: the receiving end picks it up via the
// crypto-provider live query and triggers a re-key / re-unlock as needed.
async function handleSettingsChange(payload: {
  eventType: string;
  new: Record<string, unknown>;
}) {
  const row = payload.new as { id?: string; data?: string; updated_at?: number };
  if (!row || !row.data) return;
  try {
    const remote = JSON.parse(row.data) as AppSettings;
    const local = await db.settings.get("settings");
    if (!local || local.updatedAt < remote.updatedAt) {
      await db.settings.put(remote);
    }
  } catch (e) {
    console.error("[sync] realtime settings apply failed:", e);
  }
}

// ─── Auto Sync ───────────────────────────────────────────────

export function startAutoSync() {
  if (!SYNC_ENABLED) return;
  stopAutoSync();

  // Initial pull
  syncPull();

  // Realtime: instant sync when another device pushes
  realtimeChannel = supabase
    .channel("sync-entities")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "encrypted_entities" },
      handleRealtimeChange
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "encrypted_entities" },
      handleRealtimeChange
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "app_settings" },
      handleSettingsChange
    )
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "app_settings" },
      handleSettingsChange
    )
    .subscribe();

  // Fallback: periodic pull every 60s in case realtime misses something
  syncInterval = setInterval(() => syncPull(), 60_000);

  // Sync on reconnect
  window.addEventListener("online", handleOnline);
}

export function stopAutoSync() {
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
  if (typeof window !== "undefined") {
    window.removeEventListener("online", handleOnline);
  }
}

function handleOnline() {
  syncPush();
  syncPull();
}
