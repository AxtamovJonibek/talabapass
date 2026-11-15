import { router } from "expo-router";
import { copy } from "@/copy";
import { BackArrow, RoleChip, StepBars, TopBar, TopBarSpacer } from "@/ui/kit";

/** B6–B9 yuqori qatori: ←, 4 qadam chizig'i, "Biznes" yorlig'i. */
export function BusinessTop({ step, back = true }: { step: 1 | 2 | 3 | 4; back?: boolean }) {
  return (
    <TopBar>
      {back && router.canGoBack() ? <BackArrow label={copy.back} onPress={() => router.back()} /> : <TopBarSpacer />}
      <StepBars total={4} current={step} label={copy.business.steps(step)} />
      <RoleChip tone="business">{copy.role.business}</RoleChip>
    </TopBar>
  );
}
