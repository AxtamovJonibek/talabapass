import { describe, expect, it } from "vitest";
import { clampCrop, clampZoom, drawParams, INITIAL_CROP, rotateCrop, rotatedSize, scaleOf, ZOOM_MAX } from "./crop";

const VIEW = 280;

describe("crop", () => {
  it("90°/270° da eni va bo'yi almashadi", () => {
    expect(rotatedSize(400, 200, 0)).toEqual({ w: 400, h: 200 });
    expect(rotatedSize(400, 200, 90)).toEqual({ w: 200, h: 400 });
    expect(rotatedSize(400, 200, 270)).toEqual({ w: 200, h: 400 });
  });

  it("zoom 1 da qisqa tomon oynani to'ldiradi", () => {
    expect(scaleOf(560, 280, INITIAL_CROP, VIEW)).toBe(1);
    expect(scaleOf(1000, 2000, INITIAL_CROP, VIEW)).toBeCloseTo(0.28);
    // burilganda qisqa tomon o'zgarmaydi
    expect(scaleOf(1000, 2000, { ...INITIAL_CROP, rotation: 90 }, VIEW)).toBeCloseTo(0.28);
  });

  it("zoom 1–4 oralig'ida ushlanadi", () => {
    expect(clampZoom(0.2)).toBe(1);
    expect(clampZoom(9)).toBe(ZOOM_MAX);
    expect(clampZoom(Number.NaN)).toBe(1);
  });

  it("siljish rasm oynani qoplab turadigan chegarada qoladi", () => {
    // 560×280: zoom 1 da eni 560, oyna 280 → x ±140; bo'yi oynaga teng → y = 0
    expect(clampCrop({ ...INITIAL_CROP, x: 999, y: 999 }, 560, 280, VIEW)).toEqual({ rotation: 0, zoom: 1, x: 140, y: 0 });
    expect(clampCrop({ ...INITIAL_CROP, x: -999 }, 560, 280, VIEW).x).toBe(-140);
    // zoom 2 da chegara kengayadi
    expect(clampCrop({ ...INITIAL_CROP, zoom: 2, x: 999, y: 999 }, 560, 280, VIEW)).toMatchObject({ x: 420, y: 140 });
  });

  it("kichraytirilganda siljish chegaraga qaytariladi", () => {
    const zoomed = clampCrop({ ...INITIAL_CROP, zoom: 3, x: 300, y: 0 }, 280, 280, VIEW);
    expect(zoomed.x).toBe(280);
    expect(clampCrop({ ...zoomed, zoom: 1 }, 280, 280, VIEW).x).toBe(0);
  });

  it("burish: to'rt marta — joyiga qaytadi; siljish birga buriladi", () => {
    let crop = clampCrop({ ...INITIAL_CROP, zoom: 2, x: 100, y: 40 }, 600, 400, VIEW);
    const start = crop;
    for (let i = 0; i < 4; i++) crop = rotateCrop(crop, 1, 600, 400, VIEW);
    expect(crop).toEqual(start);
    expect(rotateCrop(start, 1, 600, 400, VIEW).rotation).toBe(90);
    expect(rotateCrop(start, -1, 600, 400, VIEW).rotation).toBe(270);
  });

  it("chizish parametrlari: natija masshtabi oynaga nisbatan", () => {
    const p = drawParams({ ...INITIAL_CROP, x: 10, y: -20 }, 280, 280, VIEW, 512);
    expect(p.scale).toBeCloseTo(512 / 280);
    expect(p.tx).toBeCloseTo(256 + 0); // 280×280 da siljish chegarasi 0
    expect(p.ty).toBeCloseTo(256);
    expect(drawParams({ ...INITIAL_CROP, rotation: 90 }, 280, 280, VIEW, 512).angle).toBeCloseTo(Math.PI / 2);
  });
});
