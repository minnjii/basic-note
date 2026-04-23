"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { useCrypto } from "@/components/providers/crypto-provider";
import { syncPushEntity } from "@/lib/sync/engine";
import { looksLikeCiphertext } from "@/lib/crypto";
import { isLockError } from "@/lib/decrypt-diagnostics";

/**
 * Apple Notes-style editor. Single HTML contentEditable with inline format
 * (bold / italic / underline / strikethrough), heading sizes, and lists.
 * Storage: encrypted HTML string per note (note.content).
 */

interface PlainEditorProps {
  noteId: string;
}

export interface PlainEditorHandle {
  execBold: () => void;
  execItalic: () => void;
  execUnderline: () => void;
  execStrikethrough: () => void;
  /** Set block element type for current line. null → body paragraph (div). */
  setHeading: (level: 1 | 2 | 3 | null) => void;
  toggleBulletAtCaret: () => void;
  toggleNumberedAtCaret: () => void;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Convert legacy plaintext (with optional "• " bullet prefixes) to HTML. */
function plaintextToHtml(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const parts: string[] = [];
  let inList = false;
  const flushList = () => {
    if (inList) {
      parts.push("</ul>");
      inList = false;
    }
  };
  for (const line of lines) {
    const bulletMatch = line.match(/^ *• (.*)$/);
    if (bulletMatch) {
      if (!inList) {
        parts.push("<ul>");
        inList = true;
      }
      parts.push(`<li>${escapeHtml(bulletMatch[1])}</li>`);
    } else {
      flushList();
      parts.push(`<div>${line ? escapeHtml(line) : "<br>"}</div>`);
    }
  }
  flushList();
  return parts.join("");
}

/** Rehydrate from old block-based model if present. */
async function migrateFromBlocks(
  noteId: string,
  decrypt: (s: string) => Promise<string>
): Promise<string> {
  const blocks = await db.blocks
    .where("[noteId+sortOrder]")
    .between([noteId, ""], [noteId, "\uffff"])
    .toArray();
  const active = blocks.filter((b) => !b.deletedAt);
  const parts: string[] = [];
  let inList = false;
  const flushList = () => {
    if (inList) {
      parts.push("</ul>");
      inList = false;
    }
  };
  for (const block of active) {
    let text = "";
    if (block.content) {
      try {
        text = await decrypt(block.content);
        if (looksLikeCiphertext(text)) text = "";
      } catch {
        text = "";
      }
    }
    const esc = escapeHtml(text);
    switch (block.type) {
      case "bullet":
      case "todo":
      case "numbered":
        if (!inList) {
          parts.push("<ul>");
          inList = true;
        }
        parts.push(`<li>${esc || "<br>"}</li>`);
        break;
      case "heading": {
        flushList();
        const level = block.meta?.level ?? 1;
        parts.push(`<h${level}>${esc}</h${level}>`);
        break;
      }
      case "divider":
        flushList();
        parts.push("<hr>");
        break;
      case "text":
      default:
        flushList();
        parts.push(`<div>${esc || "<br>"}</div>`);
        break;
    }
  }
  flushList();
  return parts.join("");
}

export const PlainEditor = forwardRef<PlainEditorHandle, PlainEditorProps>(
  function PlainEditor({ noteId }, forwardedRef) {
    const { encryptText, decryptText, isUnlocked } = useCrypto();
    const note = useLiveQuery(() => db.notes.get(noteId), [noteId]);
    const ref = useRef<HTMLDivElement>(null);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadedForRef = useRef<string | null>(null);

    const saveSoon = useCallback(() => {
      const el = ref.current;
      if (!el) return;
      const html = el.innerHTML;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const encrypted = await encryptText(html);
          await db.notes.update(noteId, {
            content: encrypted,
            updatedAt: Date.now(),
          });
          const updated = await db.notes.get(noteId);
          if (updated) syncPushEntity("note", updated);
        } catch (e) {
          console.error("[PlainEditor] save failed:", e);
        }
      }, 400);
    }, [encryptText, noteId]);

    // Load / migrate when note or unlock state changes.
    useEffect(() => {
      if (!isUnlocked || !note || !ref.current) return;
      if (loadedForRef.current === noteId) return;
      loadedForRef.current = noteId;

      let cancelled = false;
      (async () => {
        let html = "";
        if (note.content) {
          try {
            const decrypted = await decryptText(note.content);
            if (!looksLikeCiphertext(decrypted)) {
              html = /<[a-z][^>]*>/i.test(decrypted)
                ? decrypted
                : plaintextToHtml(decrypted);
            }
          } catch (e) {
            if (!isLockError(e)) html = "";
          }
        } else {
          html = await migrateFromBlocks(noteId, decryptText);
          if (html) {
            try {
              const encrypted = await encryptText(html);
              await db.notes.update(noteId, {
                content: encrypted,
                updatedAt: Date.now(),
              });
              const updated = await db.notes.get(noteId);
              if (updated) syncPushEntity("note", updated);
            } catch {}
          }
        }
        if (cancelled || !ref.current) return;
        if (ref.current.innerHTML !== html) {
          ref.current.innerHTML = html;
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [noteId, isUnlocked, note, decryptText, encryptText]);

    // Flush pending save when note changes / unmount.
    useEffect(() => {
      return () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }, [noteId]);

    const handleInput = useCallback(() => {
      saveSoon();
    }, [saveSoon]);

    const exec = useCallback(
      (cmd: string, value?: string) => {
        const el = ref.current;
        if (!el) return;
        if (document.activeElement !== el) el.focus();
        // execCommand is deprecated but remains the most portable way to do
        // inline formatting inside contentEditable. Chrome / Safari / Firefox
        // all still support the basic commands (bold, italic, formatBlock,
        // insertUnorderedList, insertOrderedList).
        document.execCommand(cmd, false, value);
        saveSoon();
      },
      [saveSoon]
    );

    const setHeading = useCallback(
      (level: 1 | 2 | 3 | null) => {
        exec("formatBlock", level === null ? "div" : `h${level}`);
      },
      [exec]
    );

    useImperativeHandle(
      forwardedRef,
      () => ({
        execBold: () => exec("bold"),
        execItalic: () => exec("italic"),
        execUnderline: () => exec("underline"),
        execStrikethrough: () => exec("strikeThrough"),
        setHeading,
        toggleBulletAtCaret: () => exec("insertUnorderedList"),
        toggleNumberedAtCaret: () => exec("insertOrderedList"),
      }),
      [exec, setHeading]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        const mod = e.metaKey || e.ctrlKey;
        if (!mod) return;
        if (e.key === "b" || e.key === "B") {
          e.preventDefault();
          exec("bold");
        } else if (e.key === "i" || e.key === "I") {
          e.preventDefault();
          exec("italic");
        } else if (e.key === "u" || e.key === "U") {
          e.preventDefault();
          exec("underline");
        }
      },
      [exec]
    );

    return (
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="rich-editor outline-none leading-relaxed text-foreground min-h-[50vh]"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
      />
    );
  }
);
