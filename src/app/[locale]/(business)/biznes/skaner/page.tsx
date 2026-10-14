import { Suspense } from "react";
import { PlaceholderHome } from "@/components/auth/placeholder-home";

// 8-bosqichda: B3 — QR skaner. Dinamik sahifa — o'z Suspense chegarasi bilan.
export default function ScannerPage() {
  return (
    <Suspense fallback={null}>
      <PlaceholderHome area="cashier" roles={["BUSINESS_OWNER", "CASHIER"]} />
    </Suspense>
  );
}
