"use client";

import { Button } from "@/components/ui/button";

/** `onRetry` berilmasa sahifa qayta yuklanadi (oflayn sahifada). */
export function RetryButton({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <Button type="button" variant="blue" onClick={onRetry ?? (() => window.location.reload())}>
      {label}
    </Button>
  );
}
