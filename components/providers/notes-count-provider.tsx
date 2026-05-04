"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

interface CachedCounts {
  total: number;
  byCategory: Record<string, number>;
}

interface NotesCountContextValue {
  total: number | undefined;
  byCategory: Record<string, number> | undefined;
}

const NotesCountContext = createContext<NotesCountContextValue | null>(null);

const STORAGE_KEY = "bn_notes_count_cache_v1";

function readCache(): CachedCounts | undefined {
  if (typeof sessionStorage === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.total === "number" &&
      parsed.byCategory &&
      typeof parsed.byCategory === "object"
    ) {
      return parsed as CachedCounts;
    }
  } catch {
    // ignore corrupt cache
  }
  return undefined;
}

function writeCache(counts: CachedCounts) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // storage full or disabled — silent
  }
}

export function NotesCountProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // sessionStorage hot cache: prevents header (N) flicker on full-page reload
  // by serving the previous session's counts on the very first render. The
  // useLiveQuery result replaces it once IndexedDB resolves.
  const [hot, setHot] = useState<CachedCounts | undefined>(() => readCache());

  const result = useLiveQuery(async () => {
    const all = await db.notes.toArray();
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const n of all) {
      if (n.deletedAt) continue;
      total += 1;
      if (n.categoryId) {
        byCategory[n.categoryId] = (byCategory[n.categoryId] ?? 0) + 1;
      }
    }
    return { total, byCategory };
  }, []);

  useEffect(() => {
    if (!result) return;
    writeCache(result);
    setHot(result);
  }, [result]);

  const value = useMemo<NotesCountContextValue>(
    () => ({ total: hot?.total, byCategory: hot?.byCategory }),
    [hot]
  );

  return (
    <NotesCountContext.Provider value={value}>
      {children}
    </NotesCountContext.Provider>
  );
}

export function useNotesCount(categoryId?: string | null): number | undefined {
  const ctx = useContext(NotesCountContext);
  if (!ctx) {
    throw new Error("useNotesCount must be used within NotesCountProvider");
  }
  if (typeof categoryId !== "string") return ctx.total;
  if (!ctx.byCategory) return undefined;
  return ctx.byCategory[categoryId] ?? 0;
}
