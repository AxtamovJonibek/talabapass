"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { clampCrop, clampZoom, drawParams, INITIAL_CROP, rotateCrop, ZOOM_MAX, ZOOM_MIN, type Crop } from "@/lib/crop";
import { AVATAR_SIZE } from "@/lib/profile-image";

/** Kesish oynasining tomoni (CSS px). */
const VIEW = 280;

type Source = { image: CanvasImageSource; width: number; height: number };

async function load(file: File): Promise<Source> {
  // EXIF yo'nalishi brauzerning o'zida qo'llanadi; server baribir metama'lumotni tozalaydi.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  return { image: bitmap, width: bitmap.width, height: bitmap.height };
}

function paint(canvas: HTMLCanvasElement, source: Source, crop: Crop, view: number, out: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const p = drawParams(crop, source.width, source.height, view, out);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, out, out);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, out, out);
  ctx.imageSmoothingQuality = "high";
  ctx.translate(p.tx, p.ty);
  ctx.rotate(p.angle);
  ctx.scale(p.scale, p.scale);
  ctx.drawImage(source.image, -source.width / 2, -source.height / 2);
}

/**
 * Rasmni kesish oynasi: surib joylashtirish, kattalashtirish/kichraytirish, 90° ga burish.
 * Natija — kvadrat JPEG (`AVATAR_SIZE`); yuborishni chaqiruvchi bajaradi.
 */
export function ImageCropper({ file, busy, error, onCancel, onSave }: { file: File; busy: boolean; error: string | null; onCancel: () => void; onSave: (blob: Blob) => void }) {
  const t = useTranslations("avatar");
  const dialog = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [crop, setCrop] = useState<Crop>(INITIAL_CROP);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  useEffect(() => {
    let alive = true;
    load(file).then(
      (s) => alive && setSource(s),
      () => alive && setUnreadable(true),
    );
    return () => {
      alive = false;
    };
  }, [file]);

  useEffect(() => {
    if (!source || !canvas.current) return;
    const ratio = window.devicePixelRatio || 1;
    const size = Math.round(VIEW * ratio);
    canvas.current.width = size;
    canvas.current.height = size;
    paint(canvas.current, source, crop, VIEW, size);
  }, [source, crop]);

  const update = useCallback(
    (change: (c: Crop) => Crop) => {
      if (!source) return;
      setCrop((c) => clampCrop(change(c), source.width, source.height, VIEW));
    },
    [source],
  );

  function save() {
    if (!source) return;
    const out = document.createElement("canvas");
    out.width = AVATAR_SIZE;
    out.height = AVATAR_SIZE;
    paint(out, source, crop, VIEW, AVATAR_SIZE);
    out.toBlob((blob) => blob && onSave(blob), "image/jpeg", 0.9);
  }

  const iconButton = "flex size-11 items-center justify-center rounded-full border-hair border-line bg-white text-ink";
  return (
    <dialog
      ref={dialog}
      aria-label={t("cropTitle")}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(360px,calc(100vw-24px))] rounded-22 border-0 bg-paper p-5 text-ink backdrop:bg-ink/60"
    >
      <h2 className="m-0 mb-3 text-20 font-extrabold font-stretch-110%">{t("cropTitle")}</h2>
      {unreadable ? (
        <p role="alert" className="m-0 mb-3 text-14 font-semibold text-danger">
          {t("errors.unreadable")}
        </p>
      ) : (
        <>
          <canvas
            ref={canvas}
            data-testid="crop-canvas"
            aria-label={t("cropHint")}
            style={{ width: VIEW, height: VIEW, touchAction: "none" }}
            className="mx-auto block cursor-grab rounded-16 bg-surface"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              const from = drag.current;
              if (!from) return;
              drag.current = { x: e.clientX, y: e.clientY };
              update((c) => ({ ...c, x: c.x + e.clientX - from.x, y: c.y + e.clientY - from.y }));
            }}
            onPointerUp={() => (drag.current = null)}
            onPointerCancel={() => (drag.current = null)}
            onWheel={(e) => update((c) => ({ ...c, zoom: clampZoom(c.zoom - e.deltaY / 400) }))}
          />
          <p className="mt-2 mb-0 text-center text-12 text-muted">{t("cropHint")}</p>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" aria-label={t("zoomOut")} className={iconButton} onClick={() => update((c) => ({ ...c, zoom: clampZoom(c.zoom - 0.25) }))}>
              <Icon name="minus" size={18} />
            </button>
            <input
              type="range"
              aria-label={t("zoom")}
              min={ZOOM_MIN}
              max={ZOOM_MAX}
              step={0.01}
              value={crop.zoom}
              onChange={(e) => update((c) => ({ ...c, zoom: Number(e.target.value) }))}
              className="min-w-0 flex-1 accent-ink"
            />
            <button type="button" aria-label={t("zoomIn")} className={iconButton} onClick={() => update((c) => ({ ...c, zoom: clampZoom(c.zoom + 0.25) }))}>
              <Icon name="plus" size={18} />
            </button>
          </div>
          <div className="mt-2 flex justify-center gap-2">
            <button
              type="button"
              className="flex h-11 items-center gap-1.5 rounded-12 border-hair border-line bg-white px-3.5 font-sans text-14 font-bold text-ink"
              onClick={() => source && setCrop((c) => rotateCrop(c, -1, source.width, source.height, VIEW))}
            >
              <span aria-hidden="true">↺</span>
              {t("rotateLeft")}
            </button>
            <button
              type="button"
              className="flex h-11 items-center gap-1.5 rounded-12 border-hair border-line bg-white px-3.5 font-sans text-14 font-bold text-ink"
              onClick={() => source && setCrop((c) => rotateCrop(c, 1, source.width, source.height, VIEW))}
            >
              <span aria-hidden="true">↻</span>
              {t("rotateRight")}
            </button>
          </div>
        </>
      )}
      {error ? (
        <p role="alert" className="mt-3 mb-0 text-13 font-bold text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex gap-2.5">
        <Button variant="outline-soft" size="sm" block disabled={busy} onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button variant="ink" size="sm" block disabled={busy || !source} onClick={save}>
          {busy ? t("saving") : t("save")}
        </Button>
      </div>
    </dialog>
  );
}
