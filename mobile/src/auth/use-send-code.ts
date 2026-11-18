import { useState } from "react";
import { ApiError, errorText } from "@/api/client";
import { authApi, type Intent } from "@/api/endpoints";
import { copy } from "@/copy";
import { toE164 } from "@/lib/phone";
import { useApp } from "@/state";

/**
 * SMS kod so'rash (Auth, Auth2, Kod "Qayta yuborish"). `too_soon` — kod hozirgina yuborilgan: foydalanuvchida bor,
 * kod kiritish qadamiga o'tiladi (saytdagi `confirmPhone` kabi).
 */
export function useSendCode() {
  const { setFlow } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (digits: string, intent: Intent): Promise<boolean> => {
    if (digits.length !== 9) {
      setError(copy.login.phoneInvalid);
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await authApi.requestCode(toE164(digits));
      setFlow({ phone: digits, intent, verify: null, reset: null, social: null, resendAt: Date.now() + r.resendInSeconds * 1000 });
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.code === "too_soon") {
        setFlow({ phone: digits, intent, verify: null, reset: null, social: null, resendAt: Date.now() + Number(e.details.retryInSeconds ?? 60) * 1000 });
        return true;
      }
      setError(errorText(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { send, busy, error, setError };
}
