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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Pragmatic URL matcher for trailing-token auto-link. Matches:
//   https?://example.com/path?q=1
//   www.example.com
// Excludes trailing punctuation that's typically sentence-final.
const URL_TRAILING_RE = /(?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,!?;:)\]}]/i;

function normalizeUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function findAnchorAncestor(node: Node | null): HTMLAnchorElement | null {
  let cur: Node | null = node;
  while (cur) {
    if (cur.nodeType === 1 && (cur as Element).tagName === "A") {
      return cur as HTMLAnchorElement;
    }
    cur = cur.parentNode;
  }
  return null;
}

const HIGHLIGHT_CLASS = "bn-highlight";

function findHighlightAncestor(
  node: Node | null,
  root: Node
): HTMLElement | null {
  let cur: Node | null = node;
  while (cur && cur !== root) {
    if (
      cur.nodeType === 1 &&
      (cur as Element).tagName === "MARK" &&
      (cur as Element).classList.contains(HIGHLIGHT_CLASS)
    ) {
      return cur as HTMLElement;
    }
    cur = cur.parentNode;
  }
  return null;
}

function unwrapElement(el: Element) {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

// Collapse the caret to the end of `el`. Best-effort: if the mobile browser
// drops the programmatic selection the block swap still took effect visually.
function placeCaretAtEnd(el: Element) {
  const sel = window.getSelection();
  if (!sel) return;
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);
}

// Convert legacy plaintext (newline-separated) to HTML <div> lines.
// Used when an older note.content was saved as plaintext rather than HTML.
function plaintextToHtml(text: string): string {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => `<div>${line ? escapeHtml(line) : "<br>"}</div>`)
    .join("");
}

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
  /** Heading level of the block under the caret (null = body). */
  getHeadingLevel: () => 1 | 2 | 3 | null;
  /** Snapshot the current selection so it can be restored after focus loss. */
  saveSelection: () => void;
  /** Refocus the editor and re-apply the last snapshotted selection. */
  restoreSelection: () => void;
  toggleBulletAtCaret: () => void;
  toggleNumberedAtCaret: () => void;
  /** Wrap selection (or insert) with `<a href>`. Empty url → unlink. */
  createLink: (url: string) => void;
  unlinkAtCaret: () => void;
  /** Whether the current selection sits inside an existing anchor. */
  isLinkAtCaret: () => boolean;
  /** Toggle a `<mark.bn-highlight>` over the selection / caret. */
  toggleHighlight: () => void;
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
        }
        if (cancelled || !ref.current) return;
        if (ref.current.innerHTML !== html) {
          ref.current.innerHTML = html;
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [noteId, isUnlocked, note, decryptText]);

    // Flush pending save when note changes / unmount.
    useEffect(() => {
      return () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }, [noteId]);

    // Toggle data-mod on the editor while Cmd/Ctrl is held — drives the
    // pointer-cursor rule in globals.css so users see "this is clickable now".
    useEffect(() => {
      const apply = (down: boolean) => {
        const el = ref.current;
        if (!el) return;
        if (down) el.setAttribute("data-mod", "1");
        else el.removeAttribute("data-mod");
      };
      const onDown = (e: KeyboardEvent) => {
        if (e.key === "Meta" || e.key === "Control") apply(true);
      };
      const onUp = (e: KeyboardEvent) => {
        if (e.key === "Meta" || e.key === "Control") apply(false);
      };
      const onBlur = () => apply(false);
      window.addEventListener("keydown", onDown);
      window.addEventListener("keyup", onUp);
      window.addEventListener("blur", onBlur);
      return () => {
        window.removeEventListener("keydown", onDown);
        window.removeEventListener("keyup", onUp);
        window.removeEventListener("blur", onBlur);
      };
    }, []);

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
        const el = ref.current;
        if (!el) return;

        // Resolve the target range. On mobile the live selection is usually
        // gone by the time the dropdown item fires (the tap blurred the
        // editor), so prefer the snapshot taken on the trigger's pointerdown.
        let range = savedRangeRef.current;
        const sel = window.getSelection();
        if (!range || !el.contains(range.startContainer)) {
          if (
            sel &&
            sel.rangeCount > 0 &&
            el.contains(sel.getRangeAt(0).startContainer)
          ) {
            range = sel.getRangeAt(0);
          }
        }
        if (!range || !el.contains(range.startContainer)) return;

        // 캐럿이 위치한 가장 가까운 block (LI 포함)을 찾는다.
        let node: Node | null = range.startContainer;
        if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        let block: Element | null = node as Element | null;
        const BLOCK_RE = /^(H[1-6]|P|DIV|LI)$/;
        while (block && block !== el && !BLOCK_RE.test(block.tagName)) {
          block = block.parentElement;
        }
        if (!block || block === el) return;

        const tag = level === null ? "div" : `h${level}`;

        // LI 안: li 자식 헤딩 wrap을 DOM 조작으로 교체/제거하고, 블릿(LI)은 유지.
        if (block.tagName === "LI") {
          const heading = block.querySelector("h1,h2,h3,h4,h5,h6");
          const inLi = heading && heading.parentElement === block;
          if (level === null) {
            if (inLi) {
              const frag = document.createDocumentFragment();
              while (heading!.firstChild) frag.appendChild(heading!.firstChild);
              heading!.replaceWith(frag);
            }
          } else if (inLi) {
            const newH = document.createElement(tag);
            newH.innerHTML = heading!.innerHTML;
            heading!.replaceWith(newH);
            placeCaretAtEnd(newH);
          } else {
            const newH = document.createElement(tag);
            while (block.firstChild) newH.appendChild(block.firstChild);
            block.appendChild(newH);
            placeCaretAtEnd(newH);
          }
          savedRangeRef.current = null;
          saveSoon();
          return;
        }

        // 일반 block(div/p/h*): 요소를 새 태그로 통째 교체하고 자식은 보존.
        // execCommand("formatBlock") + 선택복원은 모바일에서 불안정하므로
        // DOM 직접 교체로 확실하게 적용한다.
        const newBlock = document.createElement(tag);
        while (block.firstChild) newBlock.appendChild(block.firstChild);
        if (!newBlock.firstChild) newBlock.appendChild(document.createElement("br"));
        block.replaceWith(newBlock);
        placeCaretAtEnd(newBlock);
        savedRangeRef.current = null;
        saveSoon();
      },
      [saveSoon]
    );

    const getHeadingLevel = useCallback((): 1 | 2 | 3 | null => {
      const el = ref.current;
      if (!el) return null;
      let range = savedRangeRef.current;
      const sel = window.getSelection();
      if (!range || !el.contains(range.startContainer)) {
        if (sel && sel.rangeCount > 0) range = sel.getRangeAt(0);
      }
      if (!range) return null;
      let node: Node | null = range.startContainer;
      if (!node || !el.contains(node)) return null;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      let block: Element | null = node as Element | null;
      const BLOCK_RE = /^(H[1-6]|P|DIV|LI)$/;
      while (block && block !== el && !BLOCK_RE.test(block.tagName)) {
        block = block.parentElement;
      }
      if (!block) return null;
      let target: Element = block;
      if (block.tagName === "LI") {
        const heading = block.querySelector("h1,h2,h3,h4,h5,h6");
        if (heading && heading.parentElement === block) target = heading;
      }
      const m = target.tagName.match(/^H([1-6])$/);
      if (!m) return null;
      const lv = Number.parseInt(m[1], 10);
      return lv === 1 || lv === 2 || lv === 3 ? (lv as 1 | 2 | 3) : null;
    }, []);

    const savedRangeRef = useRef<Range | null>(null);

    const saveSelection = useCallback(() => {
      const el = ref.current;
      if (!el) return;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer)) return;
      savedRangeRef.current = range.cloneRange();
    }, []);

    const restoreSelection = useCallback(() => {
      const el = ref.current;
      const range = savedRangeRef.current;
      if (!el || !range) return;
      el.focus();
      const sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);
    }, []);

    // Apply target=_blank + rel=noopener to all anchors inside the editor.
    // Run after createLink/auto-link to harden against tab-nabbing.
    const hardenAnchors = useCallback(() => {
      const el = ref.current;
      if (!el) return;
      const anchors = el.querySelectorAll("a");
      anchors.forEach((a) => {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener noreferrer");
      });
    }, []);

    const createLink = useCallback(
      (url: string) => {
        const el = ref.current;
        if (!el) return;
        if (document.activeElement !== el) el.focus();
        const trimmed = url.trim();
        if (!trimmed) {
          document.execCommand("unlink");
          saveSoon();
          return;
        }
        const href = normalizeUrl(trimmed);
        const sel = window.getSelection();
        const collapsed = !sel || sel.isCollapsed;
        if (collapsed) {
          // No selection — insert the URL itself as the link text.
          const safe = escapeHtml(href);
          document.execCommand(
            "insertHTML",
            false,
            `<a href="${safe}" target="_blank" rel="noopener noreferrer">${safe}</a>`
          );
        } else {
          document.execCommand("createLink", false, href);
        }
        hardenAnchors();
        saveSoon();
      },
      [saveSoon, hardenAnchors]
    );

    const unlinkAtCaret = useCallback(() => {
      const el = ref.current;
      if (!el) return;
      if (document.activeElement !== el) el.focus();
      document.execCommand("unlink");
      saveSoon();
    }, [saveSoon]);

    const isLinkAtCaret = useCallback(() => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return false;
      return findAnchorAncestor(sel.anchorNode) !== null;
    }, []);

    const toggleHighlight = useCallback(() => {
      const el = ref.current;
      if (!el) return;
      if (document.activeElement !== el) el.focus();
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      // Caret inside an existing highlight → unwrap it (toggle off).
      const existing = findHighlightAncestor(range.startContainer, el);
      if (existing) {
        unwrapElement(existing);
        saveSoon();
        return;
      }
      // Empty selection without existing highlight → no-op.
      if (range.collapsed) return;
      const mark = document.createElement("mark");
      mark.className = HIGHLIGHT_CLASS;
      try {
        range.surroundContents(mark);
      } catch {
        // Range crosses element boundaries — extract+insert is more permissive.
        const fragment = range.extractContents();
        mark.appendChild(fragment);
        range.insertNode(mark);
      }
      // Restore selection to cover the new mark so a follow-up toggle works.
      const newRange = document.createRange();
      newRange.selectNodeContents(mark);
      sel.removeAllRanges();
      sel.addRange(newRange);
      saveSoon();
    }, [saveSoon]);

    // Auto-link the trailing URL token before caret. Returns true if rewrote.
    const autoLinkBeforeCaret = useCallback((): boolean => {
      const el = ref.current;
      if (!el) return false;
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType !== Node.TEXT_NODE) return false;
      // Skip if already inside an anchor.
      if (findAnchorAncestor(node)) return false;
      const text = (node as Text).data;
      const offset = range.startOffset;
      const before = text.slice(0, offset);
      // Take the token immediately before caret (split on whitespace).
      const wsMatch = /\S+$/.exec(before);
      if (!wsMatch) return false;
      const token = wsMatch[0];
      const tokenStart = wsMatch.index;
      if (!URL_TRAILING_RE.test(token)) return false;
      const m = URL_TRAILING_RE.exec(token);
      if (!m) return false;
      const matched = m[0];
      const matchStart = tokenStart + (m.index ?? 0);
      const matchEnd = matchStart + matched.length;
      // Replace the matched substring with an <a> element.
      const href = normalizeUrl(matched);
      const tail = (node as Text).splitText(matchEnd);
      const head = (node as Text).splitText(matchStart);
      // After splits: head is [matchStart..matchEnd], tail is [matchEnd..end]
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = matched;
      head.parentNode?.replaceChild(a, head);
      // Restore caret to start of tail (immediately after the new anchor).
      const newRange = document.createRange();
      newRange.setStart(tail, 0);
      newRange.collapse(true);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return true;
    }, []);

    useImperativeHandle(
      forwardedRef,
      () => ({
        execBold: () => exec("bold"),
        execItalic: () => exec("italic"),
        execUnderline: () => exec("underline"),
        execStrikethrough: () => exec("strikeThrough"),
        setHeading,
        getHeadingLevel,
        saveSelection,
        restoreSelection,
        toggleBulletAtCaret: () => exec("insertUnorderedList"),
        toggleNumberedAtCaret: () => exec("insertOrderedList"),
        createLink,
        unlinkAtCaret,
        isLinkAtCaret,
        toggleHighlight,
      }),
      [exec, setHeading, getHeadingLevel, saveSelection, restoreSelection, createLink, unlinkAtCaret, isLinkAtCaret, toggleHighlight]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        const mod = e.metaKey || e.ctrlKey;
        // Auto-link on space/enter (no modifier) before any execCommand kicks in.
        if (!mod && (e.key === " " || e.key === "Enter")) {
          if (autoLinkBeforeCaret()) saveSoon();
          // Don't preventDefault — let the space/enter character continue to be inserted.
          return;
        }
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
      [exec, autoLinkBeforeCaret, saveSoon]
    );

    // Open an anchor in a new tab. Desktop requires Cmd/Ctrl so a plain click
    // can still position the caret for editing. Touch devices have no modifier
    // key, so a tap directly on the link text opens it (a tap outside the
    // anchor falls through to normal caret placement).
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        const anchor = findAnchorAncestor(e.target as Node);
        if (!anchor) return;
        const mod = e.metaKey || e.ctrlKey;
        const coarse =
          typeof window !== "undefined" &&
          !!window.matchMedia?.("(pointer: coarse)").matches;
        if (!mod && !coarse) return;
        e.preventDefault();
        const href = anchor.getAttribute("href");
        if (!href) return;
        window.open(href, "_blank", "noopener,noreferrer");
      },
      []
    );

    return (
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="rich-editor outline-none leading-relaxed text-foreground min-h-[50vh] break-words overflow-x-hidden"
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onClick={handleClick}
      />
    );
  }
);
