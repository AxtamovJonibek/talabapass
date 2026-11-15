import { useEffect, useRef } from "react";
import { StyleSheet } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
import type { FeedDeal, Point } from "@/api/endpoints";
import { colors } from "@/theme";

export type DealsMapProps = {
  center: Point;
  radiusKm: number;
  deals: FeedDeal[];
  showsUser: boolean;
  onOpen: (id: string) => void;
};

/** Talaba joyi atrofidagi radius doirasi (ko'k, shaffof) */
const RADIUS_FILL = "rgba(36, 50, 214, 0.08)";
const RADIUS_STROKE = "rgba(36, 50, 214, 0.45)";

/** Yaqin joylar xaritasi (react-native-maps: iOS — Apple Maps, Android — Google Maps). Marker bosilsa — chegirma tafsiloti. */
export function DealsMap({ center, radiusKm, deals, showsUser, onOpen }: DealsMapProps) {
  const ref = useRef<MapView>(null);
  // Markaz yoki radius o'zgarsa — doira sig'adigan qilib suriladi
  const delta = Math.max(0.01, (radiusKm / 111) * 2.6);
  useEffect(() => {
    ref.current?.animateToRegion({ latitude: center.lat, longitude: center.lng, latitudeDelta: delta, longitudeDelta: delta }, 350);
  }, [center.lat, center.lng, delta]);

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: center.lat, longitude: center.lng, latitudeDelta: delta, longitudeDelta: delta }}
      showsUserLocation={showsUser}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      rotateEnabled={false}
    >
      <Circle center={{ latitude: center.lat, longitude: center.lng }} radius={radiusKm * 1000} fillColor={RADIUS_FILL} strokeColor={RADIUS_STROKE} strokeWidth={1.5} />
      {deals.map((d) =>
        d.point ? (
          <Marker
            key={d.id}
            coordinate={{ latitude: d.point.lat, longitude: d.point.lng }}
            title={`${d.store} · ${d.badge}`}
            description={d.title}
            pinColor={d.live ? colors.orange : colors.muted2}
            onPress={() => onOpen(d.id)}
          />
        ) : null,
      )}
    </MapView>
  );
}
