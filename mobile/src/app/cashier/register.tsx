import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ApiError, errorText } from "@/api/client";
import { bizApi } from "@/api/business";
import { copy } from "@/copy";
import { resetTo, routeFor, useApp } from "@/state";
import { ErrorBox, Eyebrow, Field, Grow, Label, Lead, PrimaryButton, RoleChip, Screen, Title, TopBar, TopBarSpacer } from "@/ui/kit";

/**
 * Kassir ro'yxati (dizaynda yo'q — RoyxatTalaba primitivlaridan): biznes egasi shu raqamga kassir taklifini yuborgan.
 * Kod va parol o'tgan (`registrationTicket`), ism-familiya → kassir hisobi → skaner. Mantiq saytdagi `/kassir/<token>` bilan bir xil.
 */
export default function CashierRegister() {
  const { flow, signIn } = useApp();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [invalid, setInvalid] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = copy.biz.cashierRegister;
  const business = flow.verify?.next === "setPassword" ? flow.verify.businessName : undefined;

  const submit = async () => {
    if (busy) return;
    if (!flow.registrationTicket) return setError(copy.login.stepExpired);
    const missing = [!firstName.trim() && "firstName", !lastName.trim() && "lastName"].filter((f): f is string => Boolean(f));
    setInvalid(missing);
    if (missing.length > 0) return setError(c.errors[missing[0]!] ?? null);
    setBusy(true);
    setError(null);
    try {
      const me = await signIn(await bizApi.registerCashier({ registrationTicket: flow.registrationTicket, firstName: firstName.trim(), lastName: lastName.trim() }));
      resetTo(routeFor(me));
    } catch (e) {
      if (e instanceof ApiError && e.fields.length > 0) {
        setInvalid(e.fields);
        setError(c.errors[e.fields[0]!] ?? errorText(e));
      } else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar>
        <TopBarSpacer />
        <RoleChip tone="business">{copy.role.cashier}</RoleChip>
      </TopBar>

      <View style={styles.hero}>
        <Eyebrow>{c.eyebrow}</Eyebrow>
        <Title text={c.title} size={42} style={styles.title} />
        <Lead text={business ? c.lead(business) : c.leadAnon} size={16} style={styles.lead} />
      </View>

      <View style={styles.field}>
        <Label>{c.firstName}</Label>
        <Field value={firstName} onChangeText={setFirstName} invalid={invalid.includes("firstName")} autoComplete="given-name" textContentType="givenName" autoCapitalize="words" autoFocus />
      </View>
      <View style={styles.field}>
        <Label>{c.lastName}</Label>
        <Field
          value={lastName}
          onChangeText={setLastName}
          invalid={invalid.includes("lastName")}
          autoComplete="family-name"
          textContentType="familyName"
          autoCapitalize="words"
          onSubmitEditing={() => void submit()}
        />
      </View>
      <ErrorBox>{error}</ErrorBox>

      <Grow />
      <PrimaryButton tone="orange" onPress={() => void submit()} loading={busy} style={styles.cta}>
        {c.submit}
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { marginTop: 32 },
  title: { marginTop: 16 },
  lead: { marginTop: 12 },
  field: { marginTop: 18 },
  cta: { marginTop: 24 },
});
