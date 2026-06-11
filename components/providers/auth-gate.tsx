"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useCrypto } from "./crypto-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { LockScreen } from "@/components/lock-screen";
import { Spinner } from "@plus-experience/design-system/ui/spinner";
import { Toaster } from "@plus-experience/design-system/ui/sonner";
import { Button } from "@plus-experience/design-system/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@plus-experience/design-system/ui/dialog";
import { Copy, Check } from "lucide-react";

function RecoveryKeyDialog() {
  const { pendingRecoveryKey, dismissRecoveryKey } = useCrypto();
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);

  if (!pendingRecoveryKey) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(pendingRecoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{t("recovery.title")}</DialogTitle>
          <DialogDescription>
            {t("recovery.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-xl bg-muted p-4">
          <code className="flex-1 break-all text-sm font-mono select-all">
            {pendingRecoveryKey}
          </code>
          <Button variant="ghost" size="xs" onClick={handleCopy}>
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("recovery.warning")}
        </p>

        <DialogFooter>
          <Button className="w-full" onClick={dismissRecoveryKey}>
            {t("recovery.saved")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { isLoading, isSetup, isUnlocked } = useCrypto();
  const pathname = usePathname();

  // The origin-only /admin dashboard has its own password gate and must not be
  // blocked by the note app's lock screen. (On installer forks /admin renders
  // its own "disabled" state — no data — so bypassing the lock is safe.)
  if (pathname?.startsWith("/admin")) {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!isSetup || !isUnlocked) {
    return <LockScreen />;
  }

  return (
    <>
      {children}
      <RecoveryKeyDialog />
      <Toaster />
    </>
  );
}
