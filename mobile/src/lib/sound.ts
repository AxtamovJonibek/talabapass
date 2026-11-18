import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Vibration } from "react-native";

/**
 * Skaner va buyurtmalar uchun signal: qisqa tovush (`assets/sounds`, `scripts/sounds.mjs` bilan yaratilgan) va tebranish.
 * Telefon ovozsiz rejimda bo'lsa ham tebranish ishlaydi. Xato (masalan, web'da audio yo'q) — jimgina o'tkaziladi.
 */

const SOURCES = {
  success: require("../../assets/sounds/success.wav"),
  error: require("../../assets/sounds/error.wav"),
  order: require("../../assets/sounds/order.wav"),
} as const;

export type Signal = keyof typeof SOURCES;

const VIBRATION: Record<Signal, number | number[]> = { success: 120, error: [0, 90, 80, 90], order: [0, 200, 120, 200, 120, 200] };

const players: Partial<Record<Signal, AudioPlayer>> = {};
let configured = false;

/** `mute` — faqat tebranish (buyurtmalardagi "Ovozli signal" o'chiq) */
export function signal(kind: Signal, { mute = false }: { mute?: boolean } = {}): void {
  Vibration.vibrate(VIBRATION[kind]);
  if (mute) return;
  try {
    if (!configured) {
      configured = true;
      void setAudioModeAsync({ playsInSilentMode: false }).catch(() => undefined);
    }
    const player = (players[kind] ??= createAudioPlayer(SOURCES[kind]));
    void player.seekTo(0);
    player.play();
  } catch (e) {
    console.warn("[sound]", e instanceof Error ? e.message : e);
  }
}
