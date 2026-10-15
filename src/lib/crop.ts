/**
 * Profil rasmini kesish (crop) hisobi — sof funksiyalar (brauzerdagi `ImageCropper` va testlar uchun).
 *
 * Kesish oynasi — `view` × `view` kvadrat. Rasm markazi oynaning markazidan (x, y) siljigan, `rotation` gradusga
 * (90 ning karralisi) burilgan va `zoom` marta kattalashtirilgan. Zoom 1 da rasmning qisqa tomoni oynani to'ldiradi
 * ("cover"): oyna hech qachon bo'sh qolmaydi.
 */
export type Rotation = 0 | 90 | 180 | 270;
export type Crop = { rotation: Rotation; zoom: number; x: number; y: number };

export const ZOOM_MIN = 1;
export const ZOOM_MAX = 4;

export const INITIAL_CROP: Crop = { rotation: 0, zoom: 1, x: 0, y: 0 };

/** Burilgan rasmning o'lchami (90/270 da eni va bo'yi almashadi). */
export function rotatedSize(width: number, height: number, rotation: Rotation): { w: number; h: number } {
  return rotation === 90 || rotation === 270 ? { w: height, h: width } : { w: width, h: height };
}

/** Rasm piksellari → oyna pikselleri masshtabi (zoom bilan). */
export function scaleOf(width: number, height: number, crop: Crop, view: number): number {
  const { w, h } = rotatedSize(width, height, crop.rotation);
  return (view / Math.min(w, h)) * clampZoom(crop.zoom);
}

export const clampZoom = (zoom: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number.isFinite(zoom) ? zoom : ZOOM_MIN));

/** Siljish: rasm oynani to'liq qoplab turadigan chegarada ushlab turiladi. */
export function clampCrop(crop: Crop, width: number, height: number, view: number): Crop {
  const zoom = clampZoom(crop.zoom);
  const { w, h } = rotatedSize(width, height, crop.rotation);
  const s = scaleOf(width, height, { ...crop, zoom }, view);
  const limitX = Math.max(0, (w * s - view) / 2);
  const limitY = Math.max(0, (h * s - view) / 2);
  return { rotation: crop.rotation, zoom, x: Math.min(limitX, Math.max(-limitX, crop.x)), y: Math.min(limitY, Math.max(-limitY, crop.y)) };
}

/** 90° ga burish; siljish yangi tomonga moslab qayta hisoblanadi. */
export function rotateCrop(crop: Crop, direction: 1 | -1, width: number, height: number, view: number): Crop {
  const rotation = ((((crop.rotation + direction * 90) % 360) + 360) % 360) as Rotation;
  // Nuqta ham rasm bilan birga buriladi: (x, y) → (−y, x) soat mili bo'yicha
  const next = direction === 1 ? { x: -crop.y, y: crop.x } : { x: crop.y, y: -crop.x };
  return clampCrop({ rotation, zoom: crop.zoom, ...next }, width, height, view);
}

export type DrawParams = { tx: number; ty: number; angle: number; scale: number };

/**
 * Canvas'ga chizish: `ctx.translate(tx, ty); ctx.rotate(angle); ctx.scale(scale, scale); ctx.drawImage(img, -w/2, -h/2)`.
 * `out` — natija canvas tomoni (oyna → natija masshtabi kiritilgan).
 */
export function drawParams(crop: Crop, width: number, height: number, view: number, out: number): DrawParams {
  const c = clampCrop(crop, width, height, view);
  const k = out / view;
  return { tx: out / 2 + c.x * k, ty: out / 2 + c.y * k, angle: (c.rotation * Math.PI) / 180, scale: scaleOf(width, height, c, view) * k };
}
