import { router, useCanGoBack } from "expo-router";
import { copy } from "@/copy";
import { BackArrow, RoleChip, StepBars, TopBar, TopBarSpacer } from "@/ui/kit";

/** B6–B9 yuqori qatori: ←, 4 qadam chizig'i, "Biznes" yorlig'i. */
export function BusinessTop({ step, back = true }: { step: 1 | 2 | 3 | 4; back?: boolean }) {
  // router.canGoBack() render paytida navigation.isFocused() ni chaqirib ogohlantirish berardi — hook fokusni to'g'ri o'qiydi
  const canGoBack = useCanGoBack();
  return (
    <TopBar>
      {back && canGoBack ? <BackArrow label={copy.back} onPress={() => router.back()} /> : <TopBarSpacer />}
      <StepBars total={4} current={step} label={copy.business.steps(step)} />
      <RoleChip tone="business">{copy.role.business}</RoleChip>
    </TopBar>
  );
}
