import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { errorText } from "@/api/client";
import { studentApi, type StudentStatusView } from "@/api/endpoints";
import { copy } from "@/copy";
import { resetTo, routeFor, useApp } from "@/state";
import { colors, font } from "@/theme";
import { Icon } from "@/ui/icons";
import { ErrorBox, FooterLink, Grow, Lead, PrimaryButton, RoleChip, Screen, Stamp, StepBars, TickDot, Title, TopBar, TopBarSpacer, Txt } from "@/ui/kit";

/** "bugun, 14:42" yoki "12.11, 14:42" (qurilma vaqti) */
function sentAt(iso: string): string {
  const d = new Date(iso);
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const today = new Date().toDateString() === d.toDateString();
  return today ? `${copy.student.today}, ${time}` : `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}, ${time}`;
}

/**
 * Tekshiruv (3/3): navbatda yoki rad etilgan. "Holatni yangilash" — tasdiqlangan bo'lsa bosh ekranga.
 * Dizaynda chizilmagan: rad etilgan holat (qizil muhr, sabab, yangi rasm).
 */
export default function StudentReview() {
  const { reloadMe } = useApp();
  const [view, setView] = useState<StudentStatusView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const s = copy.student;
  const rejected = view?.status === "REJECTED";

  const refresh = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await studentApi.status();
      setView(next);
      if (next.status !== "PENDING" && next.status !== "REJECTED") resetTo(routeFor(await reloadMe()));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }, [reloadMe]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <Screen>
      <TopBar>
        <TopBarSpacer />
        <StepBars total={3} current={3} label={s.steps(3)} />
        <RoleChip tone="student">{copy.role.student}</RoleChip>
      </TopBar>

      <View style={styles.hero}>
        <Stamp tone={rejected ? "danger" : "orange"}>{rejected ? s.stampRejected : s.stamp}</Stamp>
        <Title text={rejected ? s.rejectedTitle : s.title3} size={44} style={styles.title} />
        <Lead text={rejected ? s.rejectedLead(view?.verification?.rejectReason ?? "—") : s.lead3} size={16} style={styles.lead} />
      </View>

      <View style={styles.card}>
        <Step
          marker={<TickDot size={32} stroke={3.4} />}
          line={colors.green}
          title={s.sent}
          note={view?.verification ? sentAt(view.verification.createdAt) : undefined}
        />
        {rejected ? (
          <Step
            marker={
              <View style={[styles.marker, { backgroundColor: colors.danger }]}>
                <Icon name="x" size={16} strokeWidth={3.4} color={colors.white} />
              </View>
            }
            line={colors.line}
            title={s.rejected}
            note={s.rejectedNote}
          />
        ) : (
          <Step
            marker={
              <View style={[styles.marker, { backgroundColor: colors.orange }]}>
                <View style={styles.dot} />
              </View>
            }
            line={colors.line}
            title={s.review}
            note={s.reviewNote}
          />
        )}
        <Step marker={<View style={[styles.marker, styles.idle]} />} title={s.open} muted />
      </View>

      <ErrorBox>{error}</ErrorBox>
      <Grow />

      {rejected ? (
        <PrimaryButton icon="arrow" onPress={() => router.push("/student/card")} style={styles.cta}>
          {s.newPhoto}
        </PrimaryButton>
      ) : (
        <>
          <PrimaryButton icon="refresh" onPress={() => void refresh()} loading={busy} style={styles.cta}>
            {busy ? s.refreshing : s.refresh}
          </PrimaryButton>
          <FooterLink lead={s.otherPhoto} onPress={() => router.push("/student/card")} style={styles.other} />
        </>
      )}
    </Screen>
  );
}

function Step({ marker, line, title, note, muted = false }: { marker: React.ReactNode; line?: string; title: string; note?: string; muted?: boolean }) {
  return (
    <View style={styles.step}>
      <View style={styles.rail}>
        {marker}
        {line ? <View style={[styles.line, { backgroundColor: line }]} /> : null}
      </View>
      <View style={styles.stepText}>
        <Txt style={[font(800), { fontSize: 17, color: muted ? colors.muted2 : colors.ink }]}>{title}</Txt>
        {note ? <Txt style={{ fontSize: 14, color: colors.muted2, marginTop: 2 }}>{note}</Txt> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 36 },
  title: { marginTop: 20 },
  lead: { marginTop: 14 },
  card: { marginTop: 30, backgroundColor: colors.white, borderRadius: 24, paddingTop: 20, paddingHorizontal: 20, paddingBottom: 6 },
  step: { flexDirection: "row", gap: 14 },
  rail: { alignItems: "center" },
  line: { width: 3, flex: 1, minHeight: 26 },
  stepText: { flex: 1, paddingBottom: 18 },
  marker: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ink },
  idle: { backgroundColor: colors.track, borderWidth: 2, borderColor: colors.line },
  cta: { marginTop: 24 },
  other: { marginTop: 6 },
});
