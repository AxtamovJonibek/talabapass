import { router } from "expo-router";
import { useState } from "react";
import { Alert, Image, StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { bizApi, type BusinessProfile, type Cashiers, type OwnerDiscount } from "@/api/business";
import { copy } from "@/copy";
import { discountBadge } from "@/lib/discount";
import { formatMinute, formatMln, initials, toTashkent } from "@/lib/format";
import { colors, em, font } from "@/theme";
import { imageUrl } from "@/ui/app";
import { Icon } from "@/ui/icons";
import { Press, Txt } from "@/ui/kit";
import { mono, weekdaysLabel } from "./ui";

/*
 * B5 bloklari — saytdagi `profile-header.tsx`, `discount-list.tsx`, `cashier-list.tsx` ning telefon ko'rinishi.
 */

/** Saytdagi `Switch` (`small` — 46×28, aks holda 50×30): yoqilgani qora */
export function SiteSwitch({ checked, onChange, label, disabled = false, small = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean; small?: boolean }) {
  const [w, h, knob] = small ? [46, 28, 22] : [50, 30, 24];
  return (
    <Press
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}
      hitSlop={8}
      scale={0.96}
      style={{ width: w, height: h, borderRadius: h / 2, backgroundColor: checked ? colors.ink : colors.line }}
    >
      <View style={{ position: "absolute", top: 3, left: checked ? w - knob - 3 : 3, width: knob, height: knob, borderRadius: knob / 2, backgroundColor: colors.white }} />
    </Press>
  );
}

/** B5 qora sarlavha: belgi, nom, tur · tuman · ish vaqti, holat, tahrirlash va bugungi uch ko'rsatkich */
export function ProfileHeader({ p, top, onLogo }: { p: BusinessProfile; top: number; onLogo: () => void }) {
  const t = copy.biz.profile;
  const live = p.status === "APPROVED" || p.status === "WARNED";
  const stats = [
    { value: String(p.salesToday), label: t.salesToday },
    { value: formatMln(p.revenueToday), label: t.revenueToday },
    { value: String(p.activeDiscounts), label: t.activeDiscounts },
  ];
  return (
    <View style={[s.head, { paddingTop: top }]}>
      <View style={s.headRow}>
        <Press onPress={onLogo} accessibilityRole="button" accessibilityLabel={t.logo} scale={0.97} style={s.logo}>
          {p.logoUrl ? (
            <Image source={{ uri: imageUrl(p.logoUrl) }} style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
          ) : (
            <Txt style={[font(900, 125), { fontSize: 26 }]}>{p.name.trim().charAt(0).toUpperCase()}</Txt>
          )}
        </Press>
        <View style={s.headText}>
          <Txt style={[font(800), { fontSize: 20, letterSpacing: em(20, -0.01), color: colors.paper }]}>{p.name}</Txt>
          <Txt style={{ fontSize: 13, color: colors.fog2 }}>{[p.typeLabel ?? copy.business.kinds.find((k) => k.value === p.kind)?.label, p.district, p.workingHours].filter(Boolean).join(" · ")}</Txt>
          <View style={s.status}>
            {live ? <Icon name="check" size={12} color={colors.mint} strokeWidth={3.4} /> : null}
            <Txt style={[font(700), { fontSize: 12, color: live ? colors.mint : colors.orange }]}>{t.statuses[p.status] ?? t.statuses.PENDING}</Txt>
          </View>
        </View>
        <Press onPress={() => router.push("/biz/edit")} accessibilityRole="link" accessibilityLabel={t.editShort} scale={0.94} style={s.edit}>
          <Icon name="edit" size={18} color={colors.paper} />
        </Press>
      </View>
      <View style={s.headStats}>
        {stats.map((x) => (
          <View key={x.label} style={s.flex1}>
            <Txt style={[mono(600), { fontSize: 20, color: colors.paper }]}>{x.value}</Txt>
            <Txt style={{ fontSize: 11, color: colors.fog3 }}>{x.label}</Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Blok sarlavhasi: "Chegirmalar" + "+ Yangi" (18 / 800 / 110%) */
export function BlockHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.blockHead}>
      <Txt accessibilityRole="header" style={[font(800, 110), { fontSize: 18 }]}>
        {title}
      </Txt>
      {action && onAction ? (
        <Press onPress={onAction} accessibilityRole="link" scale={0.98} style={s.blockAction}>
          <Txt style={[font(700), { fontSize: 14, color: colors.rust }]}>{action}</Txt>
        </Press>
      ) : null}
    </View>
  );
}

const dm = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

/** B5 chegirmalar ro'yxati: yorliq, nom, jadval va bugungi sotuv; faol/to'xtatilgan — kalit (tekshiruvsiz) */
export function DiscountList({ discounts, onChange }: { discounts: OwnerDiscount[]; onChange: (next: OwnerDiscount[]) => void }) {
  const t = copy.biz.discounts;
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  if (discounts.length === 0) return <Txt style={s.empty}>{t.emptyLong}</Txt>;

  const toggle = async (id: string, active: boolean) => {
    if (busy) return;
    setBusy(id);
    const before = discounts;
    onChange(discounts.map((d) => (d.id === id ? { ...d, status: active ? "ACTIVE" : "PAUSED" } : d)));
    try {
      await bizApi.setDiscountActive(id, active);
      setFailed(false);
    } catch {
      onChange(before);
      setFailed(true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {failed ? (
        <Txt accessibilityRole="alert" style={[font(600), { fontSize: 13, color: colors.danger }]}>
          {t.toggleFailed}
        </Txt>
      ) : null}
      <View style={s.list}>
        {discounts.map((d, i) => {
          const live = d.status === "ACTIVE";
          const schedule = `${weekdaysLabel(d.weekdays, (n) => copy.weekdaysShort[n - 1] ?? "", copy.time.everyDay)} · ${formatMinute(d.fromMinute)}–${formatMinute(d.toMinute)}`;
          const state =
            d.status === "ACTIVE"
              ? `${schedule} · ${t.sold(d.soldToday, d.dailyLimit)}`
              : d.status === "REJECTED"
                ? t.rejected(d.rejectReason ?? "—")
                : d.status === "ENDED"
                  ? t.endedOn(dm(d.endsOn))
                  : `${t.state[d.status]} · ${schedule}`;
          return (
            <View key={d.id} testID="discount-row" style={[s.row, i < discounts.length - 1 ? s.rowLine : null]}>
              <View style={[s.badge, { backgroundColor: live ? colors.orange : colors.track }]}>
                <Txt style={[font(900, 70), { fontSize: 16, textAlign: "center", color: live ? colors.ink : colors.muted }]}>{discountBadge(d)}</Txt>
              </View>
              <Press onPress={() => router.push(`/biz/discount/${d.id}`)} accessibilityRole="link" scale={0.99} style={s.flex1}>
                <Txt style={[font(700), { fontSize: 14, color: live ? colors.ink : colors.muted }]}>{d.title}</Txt>
                <Txt style={{ fontSize: 12, color: colors.muted }}>{state}</Txt>
              </Press>
              {d.status === "ENDED" ? (
                <SiteSwitch small checked={false} disabled label={t.inactive} onChange={() => undefined} />
              ) : d.status === "ACTIVE" || d.status === "PAUSED" ? (
                <SiteSwitch small checked={live} disabled={busy === d.id} label={live ? t.active : t.inactive} onChange={(next) => void toggle(d.id, next)} />
              ) : null}
            </View>
          );
        })}
      </View>
    </>
  );
}

const hhmm = (iso: string) => {
  const local = toTashkent(new Date(iso));
  const day = local.date.toISOString();
  return `${day.slice(8, 10)}.${day.slice(5, 7)} ${formatMinute(local.minute)}`;
};

/** B5 kassirlar: ro'yxat, ochiq takliflar, o'chirish. Taklif — ilovada telefon raqami bilan (`/biz/cashiers`). */
export function CashierList({ data, onChanged }: { data: Cashiers; onChanged: () => void }) {
  const t = copy.biz.cashiers;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorText(e) || t.failed);
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  return (
    <View>
      <BlockHead title={t.title} action={data.canInvite ? t.inviteShort : undefined} onAction={() => router.push("/biz/cashiers")} />
      {!data.canInvite ? <Txt style={[s.muted13, { marginBottom: 8 }]}>{t.notApproved}</Txt> : null}
      {error ? (
        <Txt accessibilityRole="alert" style={[font(600), { fontSize: 13, color: colors.danger, marginBottom: 8 }]}>
          {error}
        </Txt>
      ) : null}
      {data.cashiers.length === 0 ? (
        <Txt style={s.empty}>{t.empty}</Txt>
      ) : (
        <View style={s.list}>
          {data.cashiers.map((c, i) => {
            const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone;
            return (
              <View key={c.memberId} testID="cashier-row" style={[s.row, i < data.cashiers.length - 1 ? s.rowLine : null]}>
                <View style={s.avatar}>
                  <Txt style={[font(800), { fontSize: 13 }]}>{initials(c.firstName, c.lastName)}</Txt>
                </View>
                <View style={s.flex1}>
                  <Txt style={[font(700), { fontSize: 14 }]}>{name}</Txt>
                  <Txt style={{ fontSize: 12, color: colors.muted }}>{t.scansToday(c.scansToday)}</Txt>
                </View>
                {c.shift === "on" ? (
                  <Txt style={[font(700), { fontSize: 12, color: colors.greenSite }]}>{t.onShift}</Txt>
                ) : c.shift === "ended" ? (
                  <Txt style={[font(600), { fontSize: 12, color: colors.muted }]}>{t.shiftEnded}</Txt>
                ) : null}
                <Press
                  onPress={() =>
                    Alert.alert(t.remove, t.confirmRemove(name), [
                      { text: copy.deleteAccount.confirmNo, style: "cancel" },
                      { text: t.remove, style: "destructive", onPress: () => void run(() => bizApi.removeCashier(c.memberId)) },
                    ])
                  }
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.remove}: ${name}`}
                  hitSlop={6}
                  scale={0.94}
                  style={s.remove}
                >
                  <Icon name="close" size={16} color={colors.muted} />
                </Press>
              </View>
            );
          })}
        </View>
      )}
      {data.invites.length > 0 ? (
        <View style={s.invites}>
          <Txt style={[font(600), { fontSize: 13 }]}>{t.openInvites}</Txt>
          {data.invites.map((inv) => (
            <View key={inv.id} style={s.invite}>
              <Txt style={[mono(), { fontSize: 12, color: colors.muted, flexShrink: 1 }]}>{[inv.phone, t.inviteValid(hhmm(inv.expiresAt))].filter(Boolean).join(" · ")}</Txt>
              <Press onPress={() => void run(() => bizApi.revokeInvite(inv.id))} disabled={busy} accessibilityRole="button" scale={0.97} style={s.revoke}>
                <Txt style={[font(700), { fontSize: 14, color: colors.danger }]}>{t.revoke}</Txt>
              </Press>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  head: { backgroundColor: colors.ink, paddingHorizontal: 20, paddingBottom: 20 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  logo: { width: 60, height: 60, borderRadius: 16, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  headText: { flex: 1, minWidth: 0, gap: 3 },
  status: { flexDirection: "row", alignItems: "center", gap: 5 },
  edit: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink3, alignItems: "center", justifyContent: "center" },
  headStats: { flexDirection: "row", marginTop: 18, borderTopWidth: 1, borderTopColor: colors.ink4, paddingTop: 14 },
  blockHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  blockAction: { height: 44, justifyContent: "center" },
  empty: { borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 16, fontSize: 14, lineHeight: 20, color: colors.muted },
  muted13: { fontSize: 13, color: colors.muted },
  list: { borderRadius: 16, backgroundColor: colors.white },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.surface },
  badge: { minWidth: 40, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 4 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.track, alignItems: "center", justifyContent: "center" },
  remove: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  invites: { marginTop: 12, gap: 6 },
  invite: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 14, paddingVertical: 8 },
  revoke: { height: 44, justifyContent: "center", paddingHorizontal: 8 },
});
