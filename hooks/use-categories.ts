"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";

// Module-level cache so the decrypted category list survives across page
// remounts (e.g. clicking from /notes to /notes/categories/[id] mounts a new
// page component but the user already had a populated sidebar). Without this
// the category title flashes the "카테고리" placeholder before the async
// decrypt resolves. Cleared when any consumer observes isUnlocked=false.
let decryptedCategoriesCache: Category[] | undefined = undefined;

// sessionStorage hot cache. Persists decrypted category names across full-page
// reloads (module cache is wiped on reload). Plain text labels are exposed to
// any same-origin script — note bodies remain ciphertext. Invalidated on lock.
const SS_KEY = "bn_categories_decrypted_v1";

function readCategoriesCache(): Category[] | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(SS_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Category[];
  } catch {
    // ignore corrupt cache
  }
  return undefined;
}

function writeCategoriesCache(cats: Category[]) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(SS_KEY, JSON.stringify(cats));
  } catch {
    // storage full or disabled — silent
  }
}

function clearCategoriesCache() {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(SS_KEY);
  } catch {}
}
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { getOrderBetween } from "@/lib/fractional-index";
import type { Category, CategoryTreeNode } from "@/lib/types";
import { syncPushEntity } from "@/lib/sync/engine";
import { looksLikeCiphertext } from "@/lib/crypto";
import { isLockError } from "@/lib/decrypt-diagnostics";
import { tr } from "@/lib/i18n";

function buildTree(
  categories: Category[],
  noteCounts: Record<string, number>
): CategoryTreeNode[] {
  const map = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  for (const cat of categories) {
    map.set(cat.id, {
      ...cat,
      children: [],
      noteCount: noteCounts[cat.id] ?? 0,
    });
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export function useCategories() {
  const { encryptText, decryptText, isUnlocked } = useCrypto();

  const rawCategories = useLiveQuery(async () => {
    const all = await db.categories.orderBy("sortOrder").toArray();
    return all.filter((c) => !c.deletedAt);
  }, []);

  // Decrypt category names off the live DB result. Using useEffect+state
  // (with a cancel flag) instead of a nested useLiveQuery: the second query
  // wasn't reading from Dexie, only transforming rawCategories.
  // Initial value seeds from the module-level cache so a freshly mounted page
  // (e.g. after navigation) gets the previous decrypted list immediately.
  const [decryptedCategories, setDecryptedCategories] = useState<
    Category[] | undefined
  >(() => decryptedCategoriesCache ?? readCategoriesCache());

  // Invalidate the cache when the app locks. Done in a separate effect so
  // unlock cycles always start from a clean slate (different cryptoKey).
  useEffect(() => {
    if (!isUnlocked) {
      decryptedCategoriesCache = undefined;
      clearCategoriesCache();
    }
  }, [isUnlocked]);

  useEffect(() => {
    if (!isUnlocked || !rawCategories || rawCategories.length === 0) return;

    let cancelled = false;
    (async () => {
      const result = await Promise.all(
        rawCategories.map(async (cat) => {
          try {
            const name = await decryptText(cat.name);
            if (looksLikeCiphertext(name)) {
              return { ...cat, name: tr("lock.decryptFail") };
            }
            return { ...cat, name };
          } catch (e) {
            return {
              ...cat,
              name: isLockError(e) ? "" : tr("lock.decryptFail"),
            };
          }
        })
      );
      if (!cancelled) {
        decryptedCategoriesCache = result;
        writeCategoriesCache(result);
        setDecryptedCategories(result);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rawCategories, isUnlocked, decryptText]);

  // While rawCategories is undefined (first sub-millisecond after mount),
  // fall back to the cached decrypted list so the UI doesn't flash.
  const categories: Category[] | undefined = !isUnlocked
    ? []
    : !rawCategories
    ? decryptedCategories
    : rawCategories.length === 0
    ? []
    : decryptedCategories;

  const noteCounts = useLiveQuery(async () => {
    const all = await db.notes.toArray();
    const notes = all.filter((n) => !n.deletedAt);
    const counts: Record<string, number> = {};
    for (const note of notes) {
      if (note.categoryId) {
        counts[note.categoryId] = (counts[note.categoryId] ?? 0) + 1;
      }
    }
    return counts;
  }, []);

  const tree = categories && noteCounts ? buildTree(categories, noteCounts) : [];

  const isLoading =
    isUnlocked &&
    (rawCategories === undefined ||
      (rawCategories.length > 0 && categories === undefined) ||
      noteCounts === undefined);

  const createCategory = useCallback(
    async (
      name: string,
      parentId: string | null = null,
      icon: string | null = null
    ) => {
      if (!isUnlocked) return null;

      const all = await db.categories.orderBy("sortOrder").toArray();
      const siblings = all.filter(
        (c) => c.parentId === parentId && !c.deletedAt
      );
      const lastOrder =
        siblings.length > 0 ? siblings[siblings.length - 1].sortOrder : null;

      const now = Date.now();
      const encryptedName = await encryptText(name);
      const category: Category = {
        id: nanoid(),
        parentId,
        name: encryptedName,
        icon,
        color: null,
        sortOrder: getOrderBetween(lastOrder, null),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      await db.categories.add(category);
      syncPushEntity("category", category);
      return category.id;
    },
    [isUnlocked, encryptText]
  );

  const updateCategory = useCallback(
    async (
      id: string,
      updates: {
        name?: string;
        icon?: string | null;
        parentId?: string | null;
      }
    ) => {
      if (!isUnlocked) return;

      const patch: Partial<Category> = { updatedAt: Date.now() };
      if (updates.name !== undefined) {
        patch.name = await encryptText(updates.name);
      }
      if (updates.icon !== undefined) patch.icon = updates.icon;
      if (updates.parentId !== undefined) patch.parentId = updates.parentId;

      await db.categories.update(id, patch);
      const updated = await db.categories.get(id);
      if (updated) syncPushEntity("category", updated);
    },
    [isUnlocked, encryptText]
  );

  const deleteCategory = useCallback(async (id: string) => {
    const now = Date.now();
    // Soft delete category and move its notes to uncategorized
    await db.transaction("rw", db.categories, db.notes, async () => {
      await db.categories.update(id, { deletedAt: now, updatedAt: now });
      // Move child categories to parent
      const cat = await db.categories.get(id);
      if (cat) {
        await db.categories
          .where("parentId")
          .equals(id)
          .modify({ parentId: cat.parentId, updatedAt: now });
      }
      // Uncategorize notes
      await db.notes
        .where("categoryId")
        .equals(id)
        .modify({ categoryId: null, updatedAt: now });
    });
    // Push deleted category to remote
    const deleted = await db.categories.get(id);
    if (deleted) syncPushEntity("category", deleted);
  }, []);

  const deleteCategoryWithNotes = useCallback(async (id: string) => {
    const now = Date.now();
    await db.transaction("rw", db.categories, db.notes, async () => {
      await db.categories.update(id, { deletedAt: now, updatedAt: now });
      const cat = await db.categories.get(id);
      if (cat) {
        await db.categories
          .where("parentId")
          .equals(id)
          .modify({ parentId: cat.parentId, updatedAt: now });
      }
      const categoryNotes = await db.notes
        .where("categoryId")
        .equals(id)
        .filter((n) => !n.deletedAt)
        .toArray();
      for (const note of categoryNotes) {
        await db.notes.update(note.id, { deletedAt: now, updatedAt: now });
      }
    });
    const deletedCat = await db.categories.get(id);
    if (deletedCat) syncPushEntity("category", deletedCat);
    const deletedNotes = await db.notes
      .where("categoryId")
      .equals(id)
      .toArray();
    for (const note of deletedNotes) {
      syncPushEntity("note", note);
    }
  }, []);

  return {
    categories: categories ?? [],
    tree,
    isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
    deleteCategoryWithNotes,
  };
}
