import { Suspense } from "react";
import { PlaceholderHome } from "@/components/auth/placeholder-home";

// T7 — tarix keyingi bosqichda; hozircha himoyalangan vaqtinchalik sahifa
export default function StudentHistoryPage() {
  return (
    <Suspense fallback={null}>
      <PlaceholderHome area="student" roles={["STUDENT"]} />
    </Suspense>
  );
}
