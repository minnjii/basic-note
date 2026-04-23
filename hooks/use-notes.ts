"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { getOrderBetween } from "@/lib/fractional-index";
import type { Note, Block } from "@/lib/types";
import { syncPushEntity } from "@/lib/sync/engine";
import { looksLikeCiphertext } from "@/lib/crypto";
import { isLockError } from "@/lib/decrypt-diagnostics";
import { tr } from "@/lib/i18n";

export interface DecryptedNote extends Note {
  /** Decrypted title */
  decryptedTitle: string;
  /** Preview text from first block */
  preview: string;
}

export function useNotes(categoryId?: string | null) {
  const { encryptText, decryptText, isUnlocked } = useCrypto();
  // Cache (ciphertext → plaintext) so list re-renders don't redecrypt every
  // title/preview on every DB change.
  const decryptCacheRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!isUnlocked) decryptCacheRef.current.clear();
  }, [isUnlocked]);

  const rawNotes = useLiveQuery(
    async () => {
      const all = await db.notes.orderBy("updatedAt").reverse().toArray();
      const active = all.filter((n) => !n.deletedAt);
      const filtered = (categoryId !== undefined && categoryId !== null)
        ? active.filter((n) => n.categoryId === categoryId)
        : active;
      // Pinned notes always on top
      const pinned = filtered.filter((n) => n.pinned);
      const unpinned = filtered.filter((n) => !n.pinned);
      return [...pinned, ...unpinned];
    },
    [categoryId],
    [] as Note[]
  );

  const notes = useLiveQuery(
    async () => {
      if (!isUnlocked || !rawNotes || rawNotes.length === 0) return [];

      const cache = decryptCacheRef.current;

      const cachedDecrypt = async (ciphertext: string): Promise<string> => {
        const hit = cache.get(ciphertext);
        if (hit !== undefined) return hit;
        const text = await decryptText(ciphertext);
        cache.set(ciphertext, text);
        return text;
      };

      const decrypted = await Promise.all(
        rawNotes.map(async (note) => {
          let decryptedTitle = "";
          let preview = "";
          try {
            const title = await cachedDecrypt(note.title);
            decryptedTitle = looksLikeCiphertext(title) ? tr("lock.decryptFail") : title;
          } catch (e) {
            decryptedTitle = isLockError(e) ? "" : tr("lock.decryptFail");
          }

          // Preview: prefer new single-editable `content`, fall back to
          // first non-empty legacy block for unmigrated notes.
          try {
            if (note.content) {
              const raw = await cachedDecrypt(note.content);
              if (!looksLikeCiphertext(raw)) {
                // Content may be HTML (new model) or plaintext (pre-HTML
                // notes). Strip tags and grab first non-empty line.
                let text = raw;
                if (/<[a-z][^>]*>/i.test(raw)) {
                  if (typeof document !== "undefined") {
                    const tpl = document.createElement("template");
                    tpl.innerHTML = raw;
                    text = tpl.content.textContent ?? "";
                  } else {
                    text = raw.replace(/<[^>]*>/g, " ");
                  }
                }
                for (const rawLine of text.split(/\n|\r/)) {
                  const line = rawLine.replace(/^( *)• /, "$1").trim();
                  if (!line) continue;
                  preview = line.length > 80 ? line.slice(0, 80) + "…" : line;
                  break;
                }
              }
            }
            if (!preview) {
              const blocks = await db.blocks
                .where("[noteId+sortOrder]")
                .between([note.id, ""], [note.id, "\uffff"])
                .toArray();
              for (const block of blocks) {
                if (block.deletedAt) continue;
                if (!block.content) continue;
                try {
                  const text = await cachedDecrypt(block.content);
                  if (looksLikeCiphertext(text)) continue;
                  const trimmed = text.trim();
                  if (!trimmed) continue;
                  preview = trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed;
                  break;
                } catch {
                  continue;
                }
              }
            }
          } catch {
            preview = "";
          }

          return { ...note, decryptedTitle, preview } as DecryptedNote;
        })
      );
      return decrypted;
    },
    [rawNotes, isUnlocked],
    [] as DecryptedNote[]
  );

  const createNote = useCallback(
    async (categoryId: string | null = null): Promise<string | null> => {
      if (!isUnlocked) return null;

      const now = Date.now();
      const noteId = nanoid();
      const encryptedTitle = await encryptText("새 노트");
      const encryptedContent = await encryptText("");

      await db.transaction("rw", db.notes, db.blocks, async () => {
        await db.notes.add({
          id: noteId,
          categoryId,
          title: encryptedTitle,
          pinned: false,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });

        // Create initial empty text block
        await db.blocks.add({
          id: nanoid(),
          noteId,
          type: "text",
          content: encryptedContent,
          indent: 0,
          sortOrder: getOrderBetween(null, null),
          meta: {},
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        });
      });

      // Sync note and block to remote
      const note = await db.notes.get(noteId);
      if (note) syncPushEntity("note", note);
      const block = await db.blocks.where("noteId").equals(noteId).first();
      if (block) syncPushEntity("block", block);

      return noteId;
    },
    [isUnlocked, encryptText]
  );

  const deleteNote = useCallback(async (id: string) => {
    const now = Date.now();
    await db.transaction("rw", db.notes, db.blocks, async () => {
      await db.notes.update(id, { deletedAt: now, updatedAt: now });
      await db.blocks
        .where("noteId")
        .equals(id)
        .modify({ deletedAt: now, updatedAt: now });
    });
    const deleted = await db.notes.get(id);
    if (deleted) syncPushEntity("note", deleted);
  }, []);

  const updateNoteTitle = useCallback(
    async (id: string, title: string) => {
      if (!isUnlocked) return;
      const encryptedTitle = await encryptText(title);
      await db.notes.update(id, {
        title: encryptedTitle,
        updatedAt: Date.now(),
      });
      const updated = await db.notes.get(id);
      if (updated) syncPushEntity("note", updated);
    },
    [isUnlocked, encryptText]
  );

  const togglePin = useCallback(async (id: string) => {
    const note = await db.notes.get(id);
    if (note) {
      await db.notes.update(id, {
        pinned: !note.pinned,
        updatedAt: Date.now(),
      });
      const updated = await db.notes.get(id);
      if (updated) syncPushEntity("note", updated);
    }
  }, []);

  const updateNoteDate = useCallback(async (id: string, date: number) => {
    await db.notes.update(id, {
      createdAt: date,
      updatedAt: Date.now(),
    });
    const updated = await db.notes.get(id);
    if (updated) syncPushEntity("note", updated);
  }, []);

  const moveToCategory = useCallback(async (noteId: string, categoryId: string | null) => {
    await db.notes.update(noteId, {
      categoryId,
      updatedAt: Date.now(),
    });
    const updated = await db.notes.get(noteId);
    if (updated) syncPushEntity("note", updated);
  }, []);

  return {
    notes: notes ?? [],
    createNote,
    deleteNote,
    updateNoteTitle,
    updateNoteDate,
    togglePin,
    moveToCategory,
  };
}
