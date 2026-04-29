// ─── Core Entities ───────────────────────────────────────────
export interface Category {
  id: string;
  parentId: string | null;
  name: string; // encrypted
  icon: string | null; // lucide icon name
  color: string | null; // token name e.g. "chart-1"
  sortOrder: string; // fractional index
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Note {
  id: string;
  categoryId: string | null;
  title: string; // encrypted
  content?: string; // encrypted plaintext body (new single-editable model)
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ─── App Settings ────────────────────────────────────────────
export type ViewMode = "list" | "category" | "calendar";

export interface AppSettings {
  id: "settings";
  encryptionSalt: string; // base64
  encryptionVerifier: string; // encrypted known-plaintext
  encryptedMasterKey?: string; // master key wrapped by password-derived key
  recoverySalt?: string; // base64, salt for recovery key derivation
  recoveryEncryptedMasterKey?: string; // master key wrapped by recovery-derived key
  recoveryKeyEncrypted?: string; // recovery key encrypted with master key (for viewing)
  lockTimeoutMinutes: number;
  defaultView: ViewMode;
  createdAt: number;
  updatedAt: number;
}

// ─── Sync ────────────────────────────────────────────────────
export type SyncOperation = "create" | "update" | "delete";
export type SyncEntityType = "note" | "category";

export interface SyncMeta {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  timestamp: number;
  synced: boolean;
}

// ─── UI Helpers ──────────────────────────────────────────────
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  noteCount: number;
}
