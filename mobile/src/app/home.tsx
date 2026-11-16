import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { copy } from "@/copy";
import { contactLine } from "@/lib/phone";
import { useApp } from "@/state";
import { colors, font } from "@/theme";
import { openSite } from "@/ui/legal";
import { FooterLink, Grow, Lead, Logo, PrimaryButton, RoleChip, Screen, Title, TopBar, Txt } from "@/ui/kit";

/**
 * Kirgandan keyingi vaqtinchalik bosh ekran (dizaynda yo'q — mavjud primitivlardan): salom, hisob qisqacha,
 * saytni ochish va chiqish. Chegirmalar lentasi, kupon/QR — keyingi bosqich.
 */
export default function Home() {
  const { me, signOut } = useApp();
  const [busy, setBusy] = useState(false);
  const h = copy.home;
  const student = me?.role === "STUDENT";
  const name = me?.firstName?.trim();

  return (
    <Screen>
      <TopBar>
        <Logo />
        <RoleChip tone={student ? "student" : "business"}>{student ? copy.role.student : copy.role.business}</RoleChip>
      </TopBar>

      <Title text={name ? h.hello(name) : h.helloAnon} size={42} style={styles.title} />
      <Lead text={student ? h.lead : h.businessLead} size={16} style={styles.lead} />

      {me ? (
        <View style={styles.card}>
          <Txt style={[font(800), { fontSize: 17 }]}>{[me.firstName, me.lastName].filter(Boolean).join(" ") || me.business?.name || ""}</Txt>
          <Txt style={styles.meta}>{contactLine(me)}</Txt>
          {me.student ? <Txt style={styles.meta}>{`${me.student.university.shortName} · ${me.student.publicId}`}</Txt> : null}
          {me.business ? <Txt style={styles.meta}>{me.business.name}</Txt> : null}
        </View>
      ) : null}

      <Grow />

      <PrimaryButton tone={student ? "blue" : "orange"} onPress={() => openSite(student ? "/chegirmalar" : "/biznes")} style={styles.cta}>
        {h.openSite}
      </PrimaryButton>
      <FooterLink
        lead={h.logout}
        onPress={() => {
          if (busy) return;
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        }}
        style={styles.logout}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 36 },
  lead: { marginTop: 14 },
  card: { marginTop: 28, backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 4 },
  meta: { fontSize: 14, color: colors.muted2 },
  cta: { marginTop: 24 },
  logout: { marginTop: 6 },
});
