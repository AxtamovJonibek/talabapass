import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, View } from "react-native";
import { appApi, type Place } from "@/api/endpoints";
import { copy } from "@/copy";
import { normalizeQuery } from "@/lib/feed";
import { useLocation } from "@/lib/location";
import { useLoad } from "@/lib/use-load";
import { colors, em, font } from "@/theme";
import { Failed, OptionRow, Sheet } from "@/ui/app";
import { Field, Note, TextAction, Txt } from "@/ui/kit";

/**
 * Joy tanlovi (saytdagi `feed/location-select.tsx`): qidiruv, "Mening joylashuvim" (xato — sababi, sozlamalar),
 * "Toshkent tumanlari", "Viloyatlar". Ro'yxat `GET /districts` dan, oyna ochilganda.
 */
export function LocationSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const l = copy.feed.location;
  const { choice, choose, locate } = useLocation();
  const [q, setQ] = useState("");
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<{ text: string; settings: boolean } | null>(null);
  const places = useLoad(useCallback(() => appApi.places(), []), visible);

  const fromGps = async () => {
    setLocating(true);
    setGpsError(null);
    const result = await locate();
    setLocating(false);
    if (result.ok) onClose();
    else setGpsError({ text: result.reason === "denied" ? l.denied : l.unavailable, settings: result.reason === "denied" && !result.canAskAgain });
  };

  const match = (p: Place) => !q.trim() || normalizeQuery(p.name).includes(normalizeQuery(q));
  const districts = places.data?.districts.filter(match) ?? [];
  const regions = places.data?.regions.filter(match) ?? [];
  const selectedId = choice && choice.kind !== "gps" ? choice.place.id : null;

  const pick = (kind: "district" | "region", place: Place) => {
    choose({ kind, place });
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={l.title} scroll>
      <Field
        height={54}
        text={17}
        value={q}
        onChangeText={setQ}
        placeholder={l.search}
        icon={{ name: "search", color: colors.muted }}
        accessibilityLabel={l.search}
        autoCorrect={false}
        returnKeyType="search"
      />
      <View style={styles.gap} />
      <OptionRow icon="locate" label={locating ? l.locating : l.gps} hint={l.gpsHint} selected={choice?.kind === "gps"} onPress={() => void fromGps()} />
      {gpsError ? (
        <View style={styles.gpsError}>
          <Note error>{gpsError.text}</Note>
          {gpsError.settings ? <TextAction onPress={() => void Linking.openSettings()}>{l.openSettings}</TextAction> : null}
        </View>
      ) : null}

      {places.loading ? <ActivityIndicator color={colors.blue} style={styles.spinner} /> : null}
      {places.error && !places.data ? <Failed error={places.error} onRetry={() => void places.reload()} /> : null}

      {districts.length ? <Group title={l.groupTashkent} /> : null}
      {districts.map((p) => (
        <OptionRow key={p.id} label={p.name} selected={selectedId === p.id} onPress={() => pick("district", p)} />
      ))}
      {regions.length ? <Group title={l.groupRegions} /> : null}
      {regions.map((p) => (
        <OptionRow key={p.id} label={p.name} selected={selectedId === p.id} onPress={() => pick("region", p)} />
      ))}
      {places.data && !districts.length && !regions.length ? <Note>{l.nothing}</Note> : null}
      <View style={styles.end} />
    </Sheet>
  );
}

function Group({ title }: { title: string }) {
  return <Txt style={[font(800), styles.group]}>{title.toUpperCase()}</Txt>;
}

const styles = StyleSheet.create({
  gap: { height: 8 },
  gpsError: { paddingHorizontal: 14 },
  spinner: { marginVertical: 20 },
  group: { fontSize: 12, letterSpacing: em(12, 0.08), color: colors.muted2, marginTop: 16, marginBottom: 4, marginLeft: 14 },
  end: { height: 12 },
});
