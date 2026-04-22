"use client";

import { useRef, useEffect, useCallback } from "react";
import type { BlockComponentProps } from "../block-types";

const HEADING_STYLES = {
  1: "text-2xl font-bold tracking-[-0.03em]",
  2: "text-xl font-semibold tracking-tight",
  3: "text-lg font-medium tracking-tight",
} as const;

export function HeadingBlock({
  content,
  indent,
  meta,
  onContentChange,
  onKeyDown,
  onFocus,
  registerRef,
  isFocused,
}: BlockComponentProps) {
  const ref = useRef<HTMLDivElement>(null);
  const contentRef = useRef(content);
  const level = (meta.level ?? 1) as 1 | 2 | 3;

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
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={`outline-none min-h-[1.5em] text-foreground ${HEADING_STYLES[level]}`}
      style={{ paddingLeft: `${indent * 1.5}rem` }}
      onInput={handleInput}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={handleBlur}
      data-placeholder={`제목 ${level}`}
    />
  );
}
