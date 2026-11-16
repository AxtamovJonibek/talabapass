import * as Network from "expo-network";
import { useSyncExternalStore } from "react";

/**
 * Tarmoq holati (expo-network): ulanish yo'q yoki internetga chiqib bo'lmaydi — oflayn. Holat noma'lum bo'lsa
 * (`isInternetReachable === null`) onlayn deb hisoblanadi: banner faqat aniq bilinganda chiqadi.
 */

let offline = false;
const listeners = new Set<(offline: boolean) => void>();

const isOffline = (s: Network.NetworkState) => s.isConnected === false || s.isInternetReachable === false;

function update(state: Network.NetworkState) {
  const next = isOffline(state);
  if (next === offline) return;
  offline = next;
  listeners.forEach((fn) => fn(next));
}

let started = false;
function start() {
  if (started) return;
  started = true;
  try {
    void Network.getNetworkStateAsync().then(update, () => undefined);
    Network.addNetworkStateListener(update);
  } catch (e) {
    console.warn("[network]", e instanceof Error ? e.message : e);
  }
}

/** API klienti uchun: yozuvchi so'rov oflaynda darhol aniq xato bilan to'xtaydi */
export const offlineNow = () => {
  start();
  return offline;
};

function subscribe(fn: () => void) {
  start();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const useOffline = (): boolean => useSyncExternalStore(subscribe, () => offline, () => false);
