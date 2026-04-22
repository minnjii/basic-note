"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { getOrderBetween } from "@/lib/fractional-index";
import type { Block, BlockType, BlockMeta } from "@/lib/types";
import { syncPushEntity } from "@/lib/sync/engine";
import { looksLikeCiphertext } from "@/lib/crypto";
import { isLockError } from "@/lib/decrypt-diagnostics";
import { tr } from "@/lib/i18n";

export interface DecryptedBlock extends Block {
  decryptedContent: string;
}

export function useBlocks(noteId: string) {
  const { encryptText, decryptText, isUnlocked } = useCrypto();
  // Cache decrypted plaintext by ciphertext. Without this, every Enter /
  // edit causes useLiveQuery to re-decrypt every block in the note, which
  // for even moderately sized notes blocks the UI for 50-200ms.
  const decryptCacheRef = useRef<Map<string, string>>(new Map());

  // Clear cache on lock so a different cryptoKey can't read stale plaintext.
  useEffect(() => {
    if (!isUnlocked) decryptCacheRef.current.clear();
  }, [isUnlocked]);

  // Optimistic local blocks — rendered immediately on createBlock before the
  // async encrypt + Dexie write has propagated. Entries get removed once the
  // real ciphertext block shows up in rawBlocks.
  const [optimisticBlocks, setOptimisticBlocks] = useState<DecryptedBlock[]>([]);

  // Per-block optimistic plaintext override. updateBlock with new content
  // records it here so React state reflects the new plaintext without waiting
  // for encrypt + Dexie roundtrip — prevents visible flicker during Enter / merge.
  const [contentOverrides, setContentOverrides] = useState<Map<string, string>>(
    new Map()
  );

  // Reset optimistic state when switching notes so stale items don't leak.
  useEffect(() => {
    setOptimisticBlocks([]);
    setContentOverrides(new Map());
  }, [noteId]);

  const rawBlocks = useLiveQuery(
    () =>
      db.blocks
        .where("[noteId+sortOrder]")
        .between([noteId, ""], [noteId, "\uffff"])
        .toArray()
        .then((blocks) => blocks.filter((b) => !b.deletedAt)),
    [noteId],
    [] as Block[]
  );

  // Drop optimistic entries that have arrived in the real rawBlocks.
  useEffect(() => {
    if (!rawBlocks || rawBlocks.length === 0) return;
    const realIds = new Set(rawBlocks.map((b) => b.id));
    setOptimisticBlocks((prev) => {
      const kept = prev.filter((b) => !realIds.has(b.id));
      return kept.length === prev.length ? prev : kept;
    });
  }, [rawBlocks]);

  // Drop content overrides once the real block's decrypted plaintext matches
  // what we wrote — i.e., our updateBlock has landed. Uses decrypt cache which
  // updateBlock already pre-populates.
  useEffect(() => {
    if (!rawBlocks || rawBlocks.length === 0) return;
    const cache = decryptCacheRef.current;
    setContentOverrides((prev) => {
      if (prev.size === 0) return prev;
      let changed = false;
      const next = new Map(prev);
      for (const [id, expected] of prev) {
        const real = rawBlocks.find((b) => b.id === id);
        if (!real) continue;
        const realPlain = real.content ? cache.get(real.content) : "";
        if (realPlain === expected) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [rawBlocks]);

  // Preserve per-block object identity across re-decrypt passes so React /
  // dnd-kit / block components don't see phantom reference churn. Every Dexie
  // write currently produces a fresh rawBlocks array; without this cache,
  // every block got a new object reference on every Enter, causing 7+ blocks
  // above to flicker from downstream re-renders.
  const prevDecryptedRef = useRef<DecryptedBlock[]>([]);

  const decryptedReal = useLiveQuery(
    async () => {
      if (!isUnlocked || !rawBlocks || rawBlocks.length === 0) {
        prevDecryptedRef.current = [];
        return [];
      }
      const cache = decryptCacheRef.current;
      const prevById = new Map(prevDecryptedRef.current.map((b) => [b.id, b]));
      const decrypted = await Promise.all(
        rawBlocks.map(async (block) => {
          let decryptedContent = "";
          try {
            if (block.content) {
              const cached = cache.get(block.content);
              if (cached !== undefined) {
                decryptedContent = cached;
              } else {
                const text = await decryptText(block.content);
                decryptedContent = looksLikeCiphertext(text)
                  ? tr("lock.decryptFail")
                  : text;
                cache.set(block.content, decryptedContent);
              }
            }
          } catch (e) {
            // Transient lock (cryptoKey briefly null): leave content empty
            // instead of poisoning React state with a sticky fail label.
            decryptedContent = isLockError(e) ? "" : tr("lock.decryptFail");
          }
          // Reuse prior reference when the block is effectively unchanged.
          const prev = prevById.get(block.id);
          if (
            prev &&
            prev.updatedAt === block.updatedAt &&
            prev.deletedAt === block.deletedAt &&
            prev.content === block.content &&
            prev.sortOrder === block.sortOrder &&
            prev.type === block.type &&
            prev.indent === block.indent &&
            prev.decryptedContent === decryptedContent
          ) {
            return prev;
          }
          return { ...block, decryptedContent } as DecryptedBlock;
        })
      );
      prevDecryptedRef.current = decrypted;
      return decrypted;
    },
    [rawBlocks, isUnlocked],
    [] as DecryptedBlock[]
  );

  const blocks = useMemo<DecryptedBlock[]>(() => {
    const real = decryptedReal ?? [];
    const withOverride = contentOverrides.size === 0
      ? real
      : real.map((b) => {
          const override = contentOverrides.get(b.id);
          return override !== undefined
            ? { ...b, decryptedContent: override }
            : b;
        });
    if (optimisticBlocks.length === 0) return withOverride;
    const realIds = new Set(withOverride.map((b) => b.id));
    const pending = optimisticBlocks.filter((b) => !realIds.has(b.id));
    if (pending.length === 0) return withOverride;
    return [...withOverride, ...pending].sort((a, b) =>
      a.sortOrder.localeCompare(b.sortOrder)
    );
  }, [decryptedReal, optimisticBlocks, contentOverrides]);

  const createBlock = useCallback(
    (
      afterBlockId: string | null,
      type: BlockType = "text",
      content: string = "",
      meta: BlockMeta = {}
    ): string | null => {
      if (!isUnlocked) return null;

      const allBlocks = rawBlocks ?? [];
      const afterIndex = afterBlockId
        ? allBlocks.findIndex((b) => b.id === afterBlockId)
        : -1;

      const before = afterIndex >= 0 ? allBlocks[afterIndex].sortOrder : null;
      const after =
        afterIndex >= 0 && afterIndex + 1 < allBlocks.length
          ? allBlocks[afterIndex + 1].sortOrder
          : null;

      const now = Date.now();
      const blockId = nanoid();
      const sortOrder = getOrderBetween(before, after);

      // Optimistic: show the block right away, with plaintext already known.
      const optimistic: DecryptedBlock = {
        id: blockId,
        noteId,
        type,
        content: "",
        decryptedContent: content,
        indent: 0,
        sortOrder,
        meta,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      setOptimisticBlocks((prev) => [...prev, optimistic]);

      // Persist in the background. Caller doesn't need to wait.
      (async () => {
        try {
          const encryptedContent = await encryptText(content);
          // Pre-populate decrypt cache so when rawBlocks updates, the block
          // doesn't go through a redundant decrypt round-trip.
          decryptCacheRef.current.set(encryptedContent, content);
          await db.blocks.add({
            id: blockId,
            noteId,
            type,
            content: encryptedContent,
            indent: 0,
            sortOrder,
            meta,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
          await db.notes.update(noteId, { updatedAt: now });
          const created = await db.blocks.get(blockId);
          if (created) syncPushEntity("block", created);
        } catch (err) {
          console.error("[useBlocks] createBlock persist failed:", err);
          setOptimisticBlocks((prev) => prev.filter((b) => b.id !== blockId));
        }
      })();

      return blockId;
    },
    [isUnlocked, encryptText, rawBlocks, noteId]
  );

  const updateBlock = useCallback(
    async (
      blockId: string,
      updates: {
        content?: string;
        type?: BlockType;
        indent?: number;
        meta?: BlockMeta;
      }
    ) => {
      if (!isUnlocked) return;

      // Optimistic: expose new plaintext to React state immediately so the
      // block component renders with the updated content, without waiting for
      // encrypt + Dexie roundtrip. Prevents Enter / merge flicker.
      if (updates.content !== undefined) {
        const plain = updates.content;
        setContentOverrides((prev) => {
          const next = new Map(prev);
          next.set(blockId, plain);
          return next;
        });
      }

      const patch: Partial<Block> = { updatedAt: Date.now() };
      if (updates.content !== undefined) {
        patch.content = await encryptText(updates.content);
        // Keep the cache in sync so decryptedReal doesn't re-decrypt this.
        decryptCacheRef.current.set(patch.content, updates.content);
      }
      if (updates.type !== undefined) patch.type = updates.type;
      if (updates.indent !== undefined) patch.indent = updates.indent;
      if (updates.meta !== undefined) patch.meta = updates.meta;

      await db.blocks.update(blockId, patch);
      await db.notes.update(noteId, { updatedAt: Date.now() });

      const updated = await db.blocks.get(blockId);
      if (updated) syncPushEntity("block", updated);
    },
    [isUnlocked, encryptText, noteId]
  );

  const deleteBlock = useCallback(
    async (blockId: string) => {
      // If this was still in optimistic state (created so fast it hadn't hit
      // the DB yet), drop it locally too.
      setOptimisticBlocks((prev) => prev.filter((b) => b.id !== blockId));
      setContentOverrides((prev) => {
        if (!prev.has(blockId)) return prev;
        const next = new Map(prev);
        next.delete(blockId);
        return next;
      });
      const now = Date.now();
      await db.blocks.update(blockId, { deletedAt: now, updatedAt: now });
      await db.notes.update(noteId, { updatedAt: now });
      const deleted = await db.blocks.get(blockId);
      if (deleted) syncPushEntity("block", deleted);
    },
    [noteId]
  );

  const reorderBlock = useCallback(
    async (blockId: string, beforeOrder: string | null, afterOrder: string | null) => {
      const newOrder = getOrderBetween(beforeOrder, afterOrder);
      await db.blocks.update(blockId, {
        sortOrder: newOrder,
        updatedAt: Date.now(),
      });
      const updated = await db.blocks.get(blockId);
      if (updated) syncPushEntity("block", updated);
    },
    []
  );

  return {
    blocks,
    createBlock,
    updateBlock,
    deleteBlock,
    reorderBlock,
  };
}
