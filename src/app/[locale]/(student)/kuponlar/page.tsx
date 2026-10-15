import { Suspense } from "react";
import { PlaceholderHome } from "@/components/auth/placeholder-home";

// T6 — kuponlar (QR) keyingi bosqichda; hozircha himoyalangan vaqtinchalik sahifa
export default function StudentCouponsPage() {
  return (
    <Suspense fallback={null}>
      <PlaceholderHome area="student" roles={["STUDENT"]} />
    </Suspense>
  );
}
