"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@plus-experience/design-system/ui/card";
import { Button } from "@plus-experience/design-system/ui/button";
import { Input } from "@plus-experience/design-system/ui/input";
import { login } from "./actions";

export function Gate() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(login, null);

  // On success the cookie is set server-side; refresh so the server component
  // re-reads it and renders the dashboard.
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="tracking-tight">관리자 인증</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="grid gap-4">
            <Input
              name="password"
              type="password"
              placeholder="비밀번호"
              autoFocus
              autoComplete="off"
            />
            {state?.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "확인 중…" : "입장"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
