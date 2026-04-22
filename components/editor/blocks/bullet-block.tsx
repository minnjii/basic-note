"use client";

import { useRef, useEffect, useCallback } from "react";
import type { BlockComponentProps } from "../block-types";

const BULLET_MARKERS = ["•", "◦", "▪", "▫", "‣"];

export function BulletBlock({
  content,
  indent,
  onContentChange,
  onKeyDown,
  onFocus,
  registerRef,
  isFocused,
}: BlockComponentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);
  const marker = BULLET_MARKERS[Math.min(indent, BULLET_MARKERS.length - 1)];

  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  useEffect(() => {
    registerRef(ref.current);
  }, [registerRef]);

  useEffect(() => {
    if (!ref.current) return;
    if (document.activeElement === ref.current) return;
    if (ref.current.textContent !== content) {
      ref.current.textContent = content;
    }
  }, [content, isFocused]);

  useEffect(() => {
    if (isFocused && ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
    }
  }, [isFocused]);

  const handleInput = useCallback(() => {
    if (ref.current) {
      onContentChange(ref.current.textContent ?? "");
    }
  }, [onContentChange]);

  const handleBlur = useCallback(() => {
    if (ref.current && ref.current.textContent !== contentRef.current) {
      ref.current.textContent = contentRef.current;
    }
  }, []);

  return (
    <div
      className="flex items-start gap-2"
      style={{ paddingLeft: `${indent * 1.5}rem` }}
    >
      <span className="select-none text-muted-foreground mt-[0.15em] shrink-0 w-4 text-center">
        {marker}
      </span>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        className="outline-none min-h-[1.5em] leading-relaxed text-foreground flex-1"
        onInput={handleInput}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={handleBlur}
        data-placeholder="리스트 항목"
      />
    </div>
  );
}
