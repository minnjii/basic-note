"use client";

import { useEffect, useRef } from "react";
import { touchSessionTimestamp } from "@/lib/crypto-session";
import { DEFAULT_LOCK_TIMEOUT_MINUTES } from "@/lib/constants";

const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
] as const;

/**
 * Lock the app after a period of user inactivity. While `enabled` is true,
 * any of the listed activity events resets the timer. Hitting the timeout
 * fires `onTimeout` once (typically the caller clears its session and
 * cryptoKey state).
 */
export function useIdleAutoLock({
  enabled,
  timeoutMinutes,
  onTimeout,
}: {
  enabled: boolean;
  timeoutMinutes: number | undefined;
  onTimeout: () => void;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) return;

    const minutes = timeoutMinutes ?? DEFAULT_LOCK_TIMEOUT_MINUTES;
    // 0 = "사용 안 함"(Never): idle 자동잠금을 걸지 않는다. (?? 는 0을
    // 거르지 못하므로 여기서 명시적으로 차단 — 안 하면 setTimeout(0)으로
    // 해제 직후 즉시 재잠금되어 "비번 쳐도 안 열림"이 된다.)
    if (minutes <= 0) return;

    const reset = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      touchSessionTimestamp();
      timerRef.current = setTimeout(
        () => onTimeoutRef.current(),
        minutes * 60 * 1000
      );
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset));
    reset();

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, timeoutMinutes]);
}
