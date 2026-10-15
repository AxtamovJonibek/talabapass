import { Suspense } from "react";
import { PlaceholderHome } from "@/components/auth/placeholder-home";

// T8 / WT4 — profil keyingi bosqichda; hozircha himoyalangan vaqtinchalik sahifa
export default function StudentProfilePage() {
  return (
    <Suspense fallback={null}>
      <PlaceholderHome area="student" roles={["STUDENT"]} />
    </Suspense>
  );
}
