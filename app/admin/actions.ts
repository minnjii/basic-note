"use server";

import { cookies } from "next/headers";

const COOKIE = "bn_admin";

// Gate for the origin-only tracking dashboard. The cookie stores the verified
// password and is re-checked against ADMIN_PASSWORD on every page load, so a
// rotated/removed env immediately invalidates existing sessions.
export type LoginState = { ok?: true; error?: string };

export async function login(
  _prev: LoginState | null,
  formData: FormData
): Promise<LoginState> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { error: "관리자 기능이 비활성화돼 있습니다." };

  const pw = String(formData.get("password") ?? "");
  if (pw !== expected) return { error: "비밀번호가 올바르지 않습니다." };

  const c = await cookies();
  c.set(COOKIE, expected, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/admin",
    maxAge: 60 * 60 * 8, // 8h
  });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function isAuthed(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(COOKIE)?.value === expected;
}
