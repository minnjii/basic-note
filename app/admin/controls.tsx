"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw, LogOut } from "lucide-react";
import { Button } from "@plus-experience/design-system/ui/button";
import { logout } from "./actions";

export function Controls() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
        새로고침
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={async () => {
          await logout();
          router.refresh();
        }}
      >
        <LogOut className="h-4 w-4" />
        로그아웃
      </Button>
    </div>
  );
}
