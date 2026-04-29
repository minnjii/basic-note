import Dexie, { type EntityTable } from "dexie";
import type {
  Category,
  Note,
  AppSettings,
  SyncMeta,
} from "./types";

const db = new Dexie("SecureNotes") as Dexie & {
  categories: EntityTable<Category, "id">;
  notes: EntityTable<Note, "id">;
  settings: EntityTable<AppSettings, "id">;
  syncMeta: EntityTable<SyncMeta, "id">;
};

db.version(1).stores({
  categories: "id, parentId, sortOrder, deletedAt",
  notes: "id, categoryId, createdAt, updatedAt, deletedAt, pinned",
  blocks: "id, noteId, sortOrder, deletedAt, [noteId+sortOrder]",
  settings: "id",
  syncMeta: "id, [entityType+entityId], synced, timestamp",
});

// v2: drop legacy `blocks` store. Phase 10-F · 2B-2.
// Safe: every active client has bn_blocks_migrated_v1 set, meaning
// migrateAllNotesToContent already swept blocks into encrypted note.content.
db.version(2).stores({
  blocks: null,
});

export { db };
