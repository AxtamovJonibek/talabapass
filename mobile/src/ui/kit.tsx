import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputInstance,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, em, font } from "@/theme";
import { Icon, UzFlag, type IconName } from "./icons";

/*
 * Ilova oqimi primitivlari: design/app-flow/*.dc.html (390×844). Saytdagi `src/components/ui/app-kit.tsx` bilan
 * bir xil bo'linish. Dizayn ramkasidagi yuqori 56px status bar joyini ham o'z ichiga oladi: xavfsiz hudud ostidan
 * kamida 12, jami esa dizayndagidek 56 (pastda: kamida 16, jami 36).
 */

const MAX_SCALE = 1.25;

/** Matn: Archivo 400, qora; tizim shrift kattalashtirishi cheklangan (dizayn qat'iy o'lchamli). */
export function Txt({ style, ...props }: TextProps) {
  return <Text maxFontSizeMultiplier={MAX_SCALE} {...props} style={[styles.txt, style]} />;
}

// ───────── ekran ─────────

export function Screen({
  children,
  scroll = true,
  bottom = 36,
  bleed = false,
  dark = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  bottom?: number;
  bleed?: boolean;
  dark?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const pad: ViewStyle = {
    paddingTop: Math.max(insets.top + 12, 56),
    paddingBottom: Math.max(insets.bottom + 16, bottom),
    paddingLeft: bleed ? 0 : 24 + insets.left,
    paddingRight: bleed ? 0 : 24 + insets.right,
  };
  const bg = { backgroundColor: dark ? colors.ink : colors.paper };
  if (!scroll) return <View style={[styles.fill, bg, pad]}>{children}</View>;
  return (
    <KeyboardAvoidingView style={[styles.fill, bg]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.grow, pad]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Pastki tugmalarni ekran tagiga suruvchi bo'sh joy (dizayndagi `flex: 1`). */
export const Grow = () => <View style={styles.fill} />;

// ───────── yuqori qator ─────────

const LOGO = {
  md: { word: 24, chip: 20, radius: 8, px: 10 },
  lg: { word: 27, chip: 22, radius: 9, px: 11 },
} as const;

/** "talaba[Pass]" (900/800, wdth 112). */
export function Logo({ size = "md" }: { size?: keyof typeof LOGO }) {
  const s = LOGO[size];
  return (
    <View style={styles.logo} accessibilityRole="header" accessibilityLabel="talabaPass">
      <Txt style={[font(900, 112), { fontSize: s.word, letterSpacing: em(s.word, -0.02) }]}>talaba</Txt>
      <View style={{ backgroundColor: colors.blue, borderRadius: s.radius, paddingHorizontal: s.px, paddingTop: 1, paddingBottom: 3 }}>
        <Txt style={[font(800, 112), { fontSize: s.chip, color: colors.white }]}>Pass</Txt>
      </View>
    </View>
  );
}

export function TopBar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.topBar, style]}>{children}</View>;
}

/** Bosilganda biroz kichrayadigan bosiladigan element (saytdagi `active:scale-[0.97]`). */
export function Press({ style, children, scale = 0.97, ...props }: React.ComponentProps<typeof Pressable> & { scale?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable {...props} style={({ pressed }) => [style, pressed && !props.disabled ? { transform: [{ scale }] } : null]}>
      {children}
    </Pressable>
  );
}

/** ← 44×44 */
export function BackArrow({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <Press onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.back} hitSlop={4} scale={0.94}>
      <Icon name="arrowLeft" size={24} strokeWidth={2.4} />
    </Press>
  );
}

export const TopBarSpacer = () => <View style={styles.square44} />;

/** "O'tkazib yuborish" */
export function SkipLink({ onPress, children }: { onPress: () => void; children: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.skip} hitSlop={6}>
      <Txt style={[font(600), styles.t15, { color: colors.muted }]}>{children}</Txt>
    </Pressable>
  );
}

/** "Talaba" (ko'k) / "Biznes" (to'q sariq) */
export function RoleChip({ tone, children }: { tone: "student" | "business"; children: string }) {
  const student = tone === "student";
  return (
    <View style={[styles.chip, { backgroundColor: student ? colors.blueTint : colors.orange }]}>
      <Txt style={[font(800), { fontSize: 14, color: student ? colors.blue : colors.ink }]}>{children}</Txt>
    </View>
  );
}

/** Qadam chiziqlari: o'tilganlari ko'k, joriysi qora, keyingilari kulrang (3 qadam — 26, 4 — 20). */
export function StepBars({ total, current, label }: { total: number; current: number; label: string }) {
  return (
    <View style={styles.row6} accessible accessibilityLabel={label}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            width: total > 3 ? 20 : 26,
            height: 6,
            borderRadius: 99,
            backgroundColor: i + 1 < current ? colors.blue : i + 1 === current ? colors.ink : colors.line,
          }}
        />
      ))}
    </View>
  );
}

/** Karusel nuqtalari: joriysi 30px qora. */
export function Dots({ total, current }: { total: number; current: number }) {
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ width: i === current ? 30 : 8, height: 8, borderRadius: 99, backgroundColor: i === current ? colors.ink : colors.dot }} />
      ))}
    </View>
  );
}

// ───────── matn bloklari ─────────

type Seg = { text: string; hl?: boolean; b?: boolean; br?: boolean };

/** `<hl>`, `<b>`, `<br>` belgilashini bo'laklarga ajratadi. */
export function parseRich(src: string): Seg[] {
  const out: Seg[] = [];
  const re = /<(hl|b)>(.*?)<\/\1>|<br\s*\/?>/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push({ text: src.slice(last, m.index) });
    if (m[0].startsWith("<br")) out.push({ text: "", br: true });
    else out.push({ text: m[2] ?? "", [m[1] as "hl" | "b"]: true });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
}

export type HighlightTone = "orange" | "blue" | "green";
const HL_BG: Record<HighlightTone, string> = { orange: colors.orange, blue: colors.blue, green: colors.green };

/**
 * Katta sarlavha (900, wdth 112, −0.02em). `<hl>` — qiya rangli "stiker" (inline-block, −1.5°): RN'da ichki matnga
 * fon/burilish berib bo'lmaydi, shuning uchun sarlavha so'zma-so'z `flex-wrap` qatorlarida quriladi.
 */
export function Title({
  text,
  size,
  loose = false,
  tone = "orange",
  tight = false,
  style,
  color = colors.ink,
}: {
  text: string;
  size: number;
  loose?: boolean;
  tone?: HighlightTone;
  /** BizHujjat: stiker ichki chekkasi 10/3 (aks holda 12/4) */
  tight?: boolean;
  style?: StyleProp<ViewStyle>;
  color?: string;
}) {
  const lineHeight = Math.round(size * (loose ? 1.04 : 1.02));
  const t: TextStyle = { ...font(900, 112), fontSize: size, lineHeight, letterSpacing: em(size, -0.02), color };
  const items: ReactNode[] = [];
  parseRich(text).forEach((seg, i) => {
    if (seg.br) {
      items.push(<View key={`br${i}`} style={styles.lineBreak} />);
      return;
    }
    if (seg.hl) {
      items.push(
        <View
          key={`hl${i}`}
          style={{
            backgroundColor: HL_BG[tone],
            borderRadius: 10,
            paddingHorizontal: tight ? 10 : 12,
            paddingBottom: tight ? 3 : 4,
            transform: [{ rotate: "-1.5deg" }],
          }}
        >
          <Txt style={[t, { color: tone === "blue" ? colors.white : colors.ink }]}>{seg.text}</Txt>
        </View>,
      );
      return;
    }
    // So'zlar oxiridagi bo'shliq bilan: qatorga sig'maganda butun so'z keyingi qatorga o'tadi
    seg.text.split(/(?<= )/).forEach((word, j) => {
      if (word) items.push(<Txt key={`w${i}-${j}`} style={t}>{word}</Txt>);
    });
  });
  return (
    <View accessible accessibilityRole="header" accessibilityLabel={parseRich(text).map((s) => s.text).join(" ")} style={[styles.titleWrap, style]}>
      {items}
    </View>
  );
}

/** Oddiy matn ichida `<b>` (qalin, qora). */
export function Rich({ text, style, boldStyle }: { text: string; style?: StyleProp<TextStyle>; boldStyle?: StyleProp<TextStyle> }) {
  return (
    <Txt style={style}>
      {parseRich(text).map((seg, i) =>
        seg.br ? "\n" : seg.b || seg.hl ? <Txt key={i} style={[font(700), { color: colors.ink }, boldStyle]}>{seg.text}</Txt> : seg.text,
      )}
    </Txt>
  );
}

const LEAD = { 15: 1.45, 16: 1.5, 17: 1.5 } as const;

/** Lead paragraf (400, #3A3834). */
export function Lead({ text, size = 17, style }: { text: string; size?: keyof typeof LEAD; style?: StyleProp<TextStyle> }) {
  return <Rich text={text} style={[{ fontSize: size, lineHeight: Math.round(size * LEAD[size]), color: colors.ink5 }, style]} />;
}

/** "QADAM 1/3 · MA'LUMOTLAR" */
export function Eyebrow({ children }: { children: string }) {
  return <Txt style={[font(700), { fontSize: 13, letterSpacing: em(13, 0.06), color: colors.muted2 }]}>{children}</Txt>;
}

/** Qiya to'q sariq kvadrat ikonka (Kod, Parol). */
export function IconTile({ icon }: { icon: IconName }) {
  return (
    <View style={styles.iconTile}>
      <Icon name={icon} size={32} strokeWidth={2.2} />
    </View>
  );
}

export function Label({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Txt style={[font(700), styles.label, style]}>{children}</Txt>;
}

/** Maydon ostidagi izoh yoki xato (13px). */
export function Note({ children, error = false, style }: { children: ReactNode; error?: boolean; style?: StyleProp<TextStyle> }) {
  return (
    <Txt accessibilityLiveRegion={error ? "polite" : "none"} style={[error ? font(600) : null, styles.note, { color: error ? colors.danger : colors.muted2 }, style]}>
      {children}
    </Txt>
  );
}

/** Ekran darajasidagi xato bloki (dizaynda chizilmagan — sayt danger ranglari). */
export function ErrorBox({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  return (
    <View style={styles.errorBox} accessibilityLiveRegion="polite">
      <Txt style={[font(600), { fontSize: 14, lineHeight: 20, color: colors.danger }]}>{children}</Txt>
    </View>
  );
}

// ───────── maydonlar ─────────

/** Fokus halqasi: chegara ko'k, tashqarida yengil halqa (dizayndagi 3px + 4px rgba) — o'lcham sakramaydi. */
const FOCUS: ViewStyle = { borderColor: colors.blue, boxShadow: "0 0 0 1px #2432D6, 0 0 0 5px rgba(36, 50, 214, 0.15)" };

const BOX = {
  54: { height: 54 + 4, borderRadius: 16, paddingHorizontal: 16 },
  58: { height: 58 + 4, borderRadius: 18, paddingHorizontal: 16 },
  60: { height: 60 + 4, borderRadius: 18, paddingLeft: 18, paddingRight: 6 },
  64: { height: 64 + 4, borderRadius: 20, paddingLeft: 18, paddingRight: 6 },
} as const;

export function FieldBox({
  height = 58,
  focused = false,
  invalid = false,
  muted = false,
  style,
  children,
}: {
  height?: keyof typeof BOX;
  focused?: boolean;
  invalid?: boolean;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View
      style={[
        styles.box,
        BOX[height],
        muted ? { backgroundColor: colors.track, borderColor: colors.line } : null,
        focused && !muted ? FOCUS : null,
        invalid ? { borderColor: colors.danger } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const INPUT = { 17: font(700), 18: font(800), 19: font(800), 22: font(800) } as const;

type FieldProps = Omit<TextInputProps, "style"> & {
  height?: keyof typeof BOX;
  text?: keyof typeof INPUT;
  invalid?: boolean;
  icon?: { name: IconName; color: string };
  inputStyle?: StyleProp<TextStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  trailing?: ReactNode;
};

/** Qutidagi matn maydoni (Ism, Biznes nomi, Manzil, STIR…). */
export function Field({ height = 58, text = 19, invalid, icon, inputStyle, boxStyle, trailing, onFocus, onBlur, ...props }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldBox height={height} focused={focused} invalid={invalid} style={[icon ? styles.gap10 : null, boxStyle]}>
      {icon ? <Icon name={icon.name} size={22} strokeWidth={2.4} color={icon.color} /> : null}
      <TextInput
        maxFontSizeMultiplier={MAX_SCALE}
        placeholderTextColor={colors.muted2}
        selectionColor={colors.blue}
        {...props}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, INPUT[text], { fontSize: text }, inputStyle]}
      />
      {trailing}
    </FieldBox>
  );
}

/** "90 123 45 67" — 9 raqam guruhlari 2-3-2-2. */
export function formatLocalPhone(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

/** Telefon: bayroq + "+998" | raqam (Auth, Auth2, AuthBiznes). `value` — faqat raqamlar (9 tagacha). */
export function PhoneBox(props: { value: string; onChange: (digits: string) => void; invalid?: boolean; autoFocus?: boolean; onSubmit?: () => void }) {
  const [focused, setFocused] = useState(false);
  return (
    <FieldBox height={64} focused={focused} invalid={props.invalid} style={styles.phoneBox}>
      <View style={styles.prefix}>
        <UzFlag />
        <Txt style={[font(800), { fontSize: 20 }]}>+998</Txt>
      </View>
      <TextInput
        maxFontSizeMultiplier={MAX_SCALE}
        value={formatLocalPhone(props.value)}
        onChangeText={(v) => props.onChange(v.replace(/\D/g, "").replace(/^998(?=\d{9})/, "").slice(0, 9))}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus={props.autoFocus}
        placeholder="90 123 45 67"
        placeholderTextColor={colors.muted2}
        selectionColor={colors.blue}
        maxLength={12}
        returnKeyType="done"
        onSubmitEditing={props.onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel="Telefon raqam"
        style={[styles.input, font(800), { fontSize: 22, letterSpacing: em(22, 0.01) }]}
      />
    </FieldBox>
  );
}

/**
 * SMS kod kataklari (Kod): 6 ta 68px katak. Haqiqiy maydon bitta, shaffof va kataklar ustida — SMS'dan avtomatik
 * to'ldirish (iOS oneTimeCode, Android sms-otp) va joylashtirish ishlaydi.
 */
export function CodeBoxes({ value, onChange, invalid, disabled, autoFocus, label }: { value: string; onChange: (v: string) => void; invalid?: boolean; disabled?: boolean; autoFocus?: boolean; label: string }) {
  const ref = useRef<TextInputInstance>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (autoFocus && !disabled) setTimeout(() => ref.current?.focus(), 250);
  }, [autoFocus, disabled]);
  const active = focused && !disabled ? Math.min(value.length, 5) : -1;
  return (
    <View>
      <View style={styles.row10} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: 6 }, (_, i) => {
          const digit = value[i];
          const current = i === active;
          return (
            <View
              key={i}
              style={[
                styles.codeCell,
                { borderColor: invalid ? colors.danger : current ? colors.blue : digit ? colors.ink : colors.line },
                current && !invalid ? FOCUS : null,
              ]}
            >
              {digit ? (
                <Txt style={[font(900), { fontSize: 30, fontVariant: ["tabular-nums"] }]}>{digit}</Txt>
              ) : current ? (
                <View style={styles.caret} />
              ) : null}
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        editable={!disabled}
        onChangeText={(v) => onChange(v.replace(/\D/g, "").slice(0, 6))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        caretHidden
        accessibilityLabel={label}
        style={styles.codeInput}
      />
    </View>
  );
}

/** Parol maydoni (Parol, Kirish): katta nuqtalar, ko'rsatish tugmasi yoki o'ngda belgi. */
export function PasswordBox({
  value,
  onChange,
  height = 60,
  invalid,
  autoFocus,
  toggle,
  trailing,
  newPassword = false,
  onSubmit,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  height?: 60 | 64;
  invalid?: boolean;
  autoFocus?: boolean;
  toggle?: { show: string; hide: string };
  trailing?: ReactNode;
  newPassword?: boolean;
  onSubmit?: () => void;
  label: string;
}) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);
  return (
    <FieldBox height={height} focused={focused} invalid={invalid} style={toggle ? null : styles.padRight18}>
      <TextInput
        maxFontSizeMultiplier={MAX_SCALE}
        value={value}
        onChangeText={onChange}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={newPassword ? "new-password" : "current-password"}
        textContentType={newPassword ? "newPassword" : "password"}
        autoFocus={autoFocus}
        returnKeyType="done"
        onSubmitEditing={onSubmit}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={colors.blue}
        accessibilityLabel={label}
        style={[styles.input, font(800), { fontSize: 22, letterSpacing: em(22, 0.08) }]}
      />
      {toggle ? (
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={visible ? toggle.hide : toggle.show}
          style={styles.square48}
        >
          <Icon name={visible ? "eyeOff" : "eye"} size={24} color={colors.muted} />
        </Pressable>
      ) : (
        trailing
      )}
    </FieldBox>
  );
}

const STRENGTH_BAR = ["", colors.danger, colors.orange, colors.green, colors.green] as const;
const STRENGTH_TEXT = ["", colors.danger, "#9A3A0E", colors.greenOk, colors.greenOk] as const;

/** Parol kuchi: 4 bo'lak + yozuv ("Yaxshi"). */
export function StrengthBars({ score, label }: { score: 0 | 1 | 2 | 3 | 4; label: string }) {
  return (
    <View style={[styles.row6, { marginTop: 12 }]} accessibilityLiveRegion="polite">
      {[1, 2, 3, 4].map((n) => (
        <View key={n} style={{ flex: 1, height: 6, borderRadius: 99, backgroundColor: score > 0 && n <= score ? STRENGTH_BAR[score] : colors.line }} />
      ))}
      {score > 0 ? <Txt style={[font(800), { marginLeft: 8, fontSize: 13, color: STRENGTH_TEXT[score] }]}>{label}</Txt> : null}
    </View>
  );
}

/** Doiradagi tasdiq belgisi (parol talablari, "tasdiqlangan", maslahatlar). */
export function TickDot({ size = 20, tone = "green", stroke = 3.6 }: { size?: number; tone?: "green" | "peach" | "idle"; stroke?: number }) {
  const bg = tone === "green" ? colors.green : tone === "peach" ? colors.peach : colors.track;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      {tone === "idle" ? null : <Icon name="tick" size={Math.round(size * 0.55)} strokeWidth={stroke} />}
    </View>
  );
}

/** Belgili qator: "Kamida 8 ta belgi", "Yorug' joyda…" */
export function TickRow({ ok = true, tone = "green", size = 20, children }: { ok?: boolean; tone?: "green" | "peach"; size?: number; children: string }) {
  return (
    <View style={styles.tickRow}>
      <TickDot size={size} tone={ok ? tone : "idle"} stroke={tone === "peach" ? 3.4 : 3.6} />
      <Txt style={[font(600), { fontSize: 14 }]}>{children}</Txt>
    </View>
  );
}

const CHOICE = {
  /** Kurs 1–4 */
  square: { flex: 1, height: 54, borderRadius: 16 },
  /** "Mag." */
  wide: { flex: 1.3, height: 54, borderRadius: 16 },
  /** Biznes kategoriyasi */
  pill: { minHeight: 44, borderRadius: 999, paddingHorizontal: 16 },
} as const;
const CHOICE_TEXT = { square: { fontSize: 20, ...font(900) }, wide: { fontSize: 16, ...font(900) }, pill: { fontSize: 15, ...font(800) } } as const;

/** Tanlov tugmasi: tanlangani qora, qolgani oq (2px qora chegara). */
export function Choice({ shape, selected, onPress, children, label }: { shape: keyof typeof CHOICE; selected: boolean; onPress: () => void; children: string; label?: string }) {
  return (
    <Press
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={[styles.choice, CHOICE[shape], { backgroundColor: selected ? colors.ink : colors.white }]}
    >
      <Txt style={[CHOICE_TEXT[shape], { color: selected ? colors.white : colors.ink }]}>{children}</Txt>
    </Press>
  );
}

// ───────── tugmalar va havolalar ─────────

const BUTTON_ICON: Record<"arrow" | "tick" | "refresh", IconName> = { arrow: "arrowRight", tick: "tick", refresh: "refresh" };

/** Asosiy tugma: 58px, radius 20, 18/800. Talaba — ko'k/oq, biznes — to'q sariq/qora. */
export function PrimaryButton({
  children,
  onPress,
  tone = "blue",
  icon = "arrow",
  loading = false,
  disabled = false,
  style,
}: {
  children: string;
  onPress: () => void;
  tone?: "blue" | "orange";
  icon?: keyof typeof BUTTON_ICON | null;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const fg = tone === "blue" ? colors.white : colors.ink;
  return (
    <Press
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[styles.primary, { backgroundColor: tone === "blue" ? colors.blue : colors.orange, opacity: disabled ? 0.55 : 1 }, style]}
    >
      <Txt style={[font(800), { fontSize: 18, color: fg }]}>{children}</Txt>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Icon name={BUTTON_ICON[icon]} size={22} strokeWidth={2.4} color={fg} /> : null}
    </Press>
  );
}

/** Pastdagi markaziy havola: "Biznes egasimisiz? <b>Bu yerdan</b>" yoki oddiy kulrang havola. */
export function FooterLink({ lead, action, onPress, style }: { lead: string; action?: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" style={[styles.footerLink, style]}>
      <Txt style={[font(600), styles.t15, { color: colors.muted }]}>
        {lead}
        {action ? (
          <Txt style={[font(800), { color: colors.blue, textDecorationLine: "underline" }]}>
            {" "}
            {action}
          </Txt>
        ) : null}
      </Txt>
    </Pressable>
  );
}

/** Ko'k qalin matnli tugma: "Raqamni o'zgartirish", "Parolni unutdim" */
export function TextAction({ children, onPress, underline = false, weight = 700, disabled }: { children: string; onPress: () => void; underline?: boolean; weight?: 700 | 800; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={styles.textAction} hitSlop={6}>
      <Txt style={[font(weight), styles.t15, { color: disabled ? colors.muted2 : colors.blue, textDecorationLine: underline ? "underline" : "none" }]}>{children}</Txt>
    </Pressable>
  );
}

/** Oq maslahat kartasi, chapda ko'k fonli belgi (Kod). */
export function TipCard({ icon, children }: { icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.tip}>
      <View style={styles.tipIcon}>
        <Icon name={icon} size={18} strokeWidth={2.4} color={colors.blue} />
      </View>
      <Txt style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink5 }}>{children}</Txt>
    </View>
  );
}

/** Qiya muhr: "TEKSHIRUVDA" (to'q sariq) yoki "RAD ETILDI" (qizil). */
export function Stamp({ children, tone = "orange" }: { children: string; tone?: "orange" | "danger" }) {
  const c = tone === "orange" ? colors.orange : colors.danger;
  return (
    <View style={[styles.stamp, { borderColor: c }]}>
      <Txt style={[font(900), { fontSize: 15, letterSpacing: em(15, 0.1), color: c }]}>{children}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  txt: { ...font(400), color: colors.ink, fontSize: 15 },
  fill: { flex: 1 },
  grow: { flexGrow: 1 },
  t15: { fontSize: 15 },
  logo: { flexDirection: "row", alignItems: "center", gap: 8 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 },
  back: { width: 44, height: 44, marginLeft: -10, alignItems: "center", justifyContent: "center" },
  square44: { width: 44, height: 44 },
  square48: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  skip: { minHeight: 44, paddingHorizontal: 2, justifyContent: "center" },
  chip: { borderRadius: 999, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 7 },
  row6: { flexDirection: "row", alignItems: "center", gap: 6 },
  row10: { flexDirection: "row", gap: 10 },
  dots: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end" },
  lineBreak: { width: "100%", height: 0 },
  iconTile: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.orange, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] },
  label: { fontSize: 14, marginBottom: 8 },
  note: { marginTop: 8, marginHorizontal: 2, fontSize: 13, lineHeight: 18 },
  errorBox: { marginTop: 14, borderRadius: 16, backgroundColor: colors.dangerBg, paddingHorizontal: 14, paddingVertical: 10 },
  box: { flexDirection: "row", alignItems: "center", borderWidth: 2, borderColor: colors.ink, backgroundColor: colors.white },
  gap10: { gap: 10 },
  phoneBox: { gap: 12, paddingRight: 18 },
  prefix: { flexDirection: "row", alignItems: "center", gap: 8, height: 32, paddingRight: 12, borderRightWidth: 2, borderRightColor: colors.lineSoft },
  input: { flex: 1, minWidth: 0, padding: 0, color: colors.ink },
  padRight18: { paddingRight: 18 },
  codeCell: { flex: 1, height: 68 + 4, borderRadius: 18, borderWidth: 2, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  caret: { width: 2, height: 30, backgroundColor: colors.blue },
  codeInput: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0.011, color: "transparent" },
  tickRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  choice: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.ink },
  primary: { height: 58, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  footerLink: { alignSelf: "center", minHeight: 44, paddingHorizontal: 14, justifyContent: "center" },
  textAction: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  tip: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: colors.white, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14 },
  tipIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.blueTint, alignItems: "center", justifyContent: "center" },
  stamp: { alignSelf: "flex-start", borderWidth: 3, borderRadius: 10, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 5, transform: [{ rotate: "-4deg" }] },
});
