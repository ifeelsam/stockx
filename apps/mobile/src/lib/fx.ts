import * as Haptics from "expo-haptics";
import { haptics, tierByMultiplier, type TierStyle } from "@scratchers/ui-tokens";

/** Tier-scaled haptics. `ui-tokens` gives a vibrate-duration pattern; map it onto expo-haptics impacts. */
export async function revealFx(multiplier: number): Promise<TierStyle> {
  const t = tierByMultiplier(multiplier);
  const pattern = haptics[t.fx];
  if (t.fx === "jackpot") {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    for (const ms of pattern.filter((_, i) => i % 2 === 0)) {
      await Haptics.impactAsync(ms >= 120 ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Medium);
      await new Promise((r) => setTimeout(r, 70));
    }
  } else if (pattern.length) {
    const style = t.fx === "shake" ? Haptics.ImpactFeedbackStyle.Heavy : t.fx === "burst" ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light;
    for (let i = 0; i < pattern.length; i += 2) {
      await Haptics.impactAsync(style);
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  return t;
}
