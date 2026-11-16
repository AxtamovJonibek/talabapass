#!/usr/bin/env python3
"""TalabaPass logo tizimi: Archivo konturlari (uharfbuzz) -> SVG -> PNG (chromium)."""
import os, math
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import uharfbuzz as hb
from playwright.sync_api import sync_playwright
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "out")
os.makedirs(OUT, exist_ok=True)

BLUE, ORANGE, INK, PAPER, GREEN = "#2432D6", "#FF5A1F", "#111111", "#F3F1EE", "#3BD16F"

src = os.path.join(HERE, "node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2")
tmp = os.path.join(HERE, "archivo-var.ttf")
if not os.path.exists(tmp):
    f = TTFont(src); f.flavor = None; f.save(tmp)
face = hb.Face(hb.Blob.from_file_path(tmp))
font = hb.Font(face)
UPEM = face.upem


def n(v):
    s = ("%.2f" % v).rstrip("0").rstrip(".")
    return s if s != "-0" else "0"


def shape(text, size, wght=900, wdth=112, x=0.0, y=0.0, track=0.0):
    """Matnni kontur yo'liga aylantiradi. Qaytaradi: (d, bounds, advance)."""
    font.set_variations({"wght": wght, "wdth": wdth})
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    hb.shape(font, buf, {"kern": True, "liga": False})
    s = size / UPEM
    pen = SVGPathPen(None, ntos=n)
    bp = BoundsPen(None)
    cx = x
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        t = (s, 0, 0, -s, cx + pos.x_offset * s, y - pos.y_offset * s)
        font.draw_glyph_with_pen(info.codepoint, TransformPen(pen, t))
        font.draw_glyph_with_pen(info.codepoint, TransformPen(bp, t))
        cx += pos.x_advance * s + track
    return pen.getCommands(), bp.bounds, cx - x


def centered(text, height, cx, cy, wght=900, wdth=112):
    """Glif bounding box balandligi `height`, markazi (cx, cy) bo'ladigan kontur."""
    _, b, _ = shape(text, 100, wght, wdth)
    k = height / (b[3] - b[1])
    size = 100 * k
    _, b, _ = shape(text, size, wght, wdth)
    ox = cx - (b[0] + b[2]) / 2
    oy = cy - (b[1] + b[3]) / 2
    d, b, a = shape(text, size, wght, wdth, ox, oy)
    return d, b


# ---------------------------------------------------------------- wordmark
def wordmark(dark_text=INK, pill=BLUE, pill_text="#FFFFFF", S=200, margin=0.14):
    d1, b1, adv1 = shape("talaba", S, 900, 112, 0, 0, track=-0.02 * S)
    ps = S * 0.84
    gap = 0.20 * S
    px = adv1 + gap - 0.02 * S * 0  # talaba tugagan joy + bo'shliq
    d2, b2, adv2 = shape("Pass", ps, 800, 112, 0, 0, track=-0.01 * ps)
    padx, pady = 0.44 * ps, 0.30 * ps
    cap = -b2[1]                       # P balandligi (baseline'dan tepaga)
    pw = (b2[2] - b2[0]) + 2 * padx
    ph = cap + 2 * pady
    pill_x = px
    pill_y = -cap - pady
    d2, b2, _ = shape("Pass", ps, 800, 112, pill_x + padx - b2[0], 0, track=-0.01 * ps)
    rad = ph * 0.30
    m = S * margin
    x0, y0 = -m - b1[0] * 0 , pill_y - m
    w = pill_x + pw + 2 * m
    h = ph + 2 * m
    body = (f'<path d="{d1}" fill="{dark_text}"/>'
            f'<rect x="{n(pill_x)}" y="{n(pill_y)}" width="{n(pw)}" height="{n(ph)}" rx="{n(rad)}" fill="{pill}"/>'
            f'<path d="{d2}" fill="{pill_text}"/>')
    return body, (x0, y0, w, h)


def svg_doc(vb, body, title, w=None, h=None):
    x, y, vw, vh = vb
    wa = f' width="{n(w)}"' if w else ""
    ha = f' height="{n(h)}"' if h else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{n(x)} {n(y)} {n(vw)} {n(vh)}"{wa}{ha} role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')


# ---------------------------------------------------------------- belgi (ticket)
def ticket_path(x, y, w, h, rc, rn):
    cy = y + h / 2
    return (f"M{n(x+rc)} {n(y)}H{n(x+w-rc)}A{n(rc)} {n(rc)} 0 0 1 {n(x+w)} {n(y+rc)}"
            f"V{n(cy-rn)}A{n(rn)} {n(rn)} 0 0 0 {n(x+w)} {n(cy+rn)}"
            f"V{n(y+h-rc)}A{n(rc)} {n(rc)} 0 0 1 {n(x+w-rc)} {n(y+h)}"
            f"H{n(x+rc)}A{n(rc)} {n(rc)} 0 0 1 {n(x)} {n(y+h-rc)}"
            f"V{n(cy+rn)}A{n(rn)} {n(rn)} 0 0 0 {n(x)} {n(cy-rn)}"
            f"V{n(y+rc)}A{n(rc)} {n(rc)} 0 0 1 {n(x+rc)} {n(y)}Z")


def mark_group(percent=True, tw=560, th=380, rc=62, rn=46, tilt=-8, t_h=250,
               badge=(226, 154), br=100, ring=BLUE, ticket="#FFFFFF", tcol=BLUE):
    tk = ticket_path(-tw / 2, -th / 2, tw, th, rc, rn)
    tp, _ = centered("t", t_h, 0, 3)
    g = (f'<g transform="rotate({tilt})"><path d="{tk}" fill="{ticket}"/>'
         f'<path d="{tp}" fill="{tcol}"/></g>')
    bx, by = badge
    g += f'<circle cx="{bx}" cy="{by}" r="{br}" fill="{ORANGE}" stroke="{ring}" stroke-width="{n(br*0.26)}"/>'
    if percent:
        pp, _ = centered("%", br * 0.92, bx, by)
        g += f'<path d="{pp}" fill="{INK}"/>'
    return g


# group bbox markazi (tilt -8, default o'lchamlar): taxminan (17, 19)
def mark_svg(size=1024, rounded=True, scale=1.12, transparent=False, percent=True,
             center=(17, 19), **kw):
    r = size * 0.226 if rounded else 0
    bg = "" if transparent else f'<rect width="{size}" height="{size}" rx="{n(r)}" fill="{BLUE}"/>'
    g = mark_group(percent=percent, **kw)
    cx, cy = center
    body = (bg + f'<g transform="translate({n(size/2)} {n(size/2)}) scale({scale}) translate({-cx} {-cy})">{g}</g>')
    return svg_doc((0, 0, size, size), body, "TalabaPass", size, size)


def notification_svg(size=96):
    """Android bildirishnoma ikonkasi: oq silueti (ticket + 't' kesilgan), shaffof fon."""
    tw, th, rc, rn = 560, 380, 62, 46
    tk = ticket_path(-tw / 2, -th / 2, tw, th, rc, rn)
    tp, _ = centered("t", 250, 0, 3)
    s = size / 640 * 0.92
    body = (f'<g transform="translate({n(size/2)} {n(size/2)}) scale({s:.4f}) rotate(-8)">'
            f'<path d="{tk} {tp}" fill="#FFFFFF" fill-rule="evenodd"/></g>')
    return svg_doc((0, 0, size, size), body, "TalabaPass", size, size)


# ---------------------------------------------------------------- OG rasm
def og_svg():
    W, H = 1200, 630
    lines = ["Talabamisiz?", "Arzonroq", "to'laysiz."]
    size = 112
    ws = [shape(t, size, 900, 112, 0, 0, track=-0.02 * size)[2] for t in lines]
    k = min(1.0, 640 / max(ws))
    size *= k
    x0, base = 72, [250, 372, 494]
    paths = []
    for t, by in zip(lines, base):
        paths.append(shape(t, size, 900, 112, x0, by, track=-0.02 * size))
    # "Arzonroq" ostidagi to'q sariq rotated blok
    d2, b2, a2 = paths[1]
    pad = 18
    blk = (f'<rect x="{n(b2[0]-pad)}" y="{n(b2[1]-pad*0.6)}" width="{n(b2[2]-b2[0]+2*pad)}" '
           f'height="{n(b2[3]-b2[1]+pad*1.4)}" rx="22" fill="{ORANGE}" '
           f'transform="rotate(-2 {n((b2[0]+b2[2])/2)} {n((b2[1]+b2[3])/2)})"/>')
    txt = ""
    for i, (d, b, a) in enumerate(paths):
        txt += f'<path d="{d}" fill="{INK}"/>'
        if i == 0:
            pass
    wm, vb = wordmark(S=64, margin=0)
    sub, sb, _ = shape("Guvohnomang yetarli.", 32, 700, 100, x0, 568)
    url, ub, _ = shape("talabapass.uz", 32, 800, 100, x0 + 360, 568)
    cx, cy, sc = 972, 318, 0.60
    g = mark_group()
    deco = (f'<circle cx="{cx}" cy="{cy}" r="250" fill="none" stroke="#D6D2CB" stroke-width="3" stroke-dasharray="4 14" stroke-linecap="round"/>'
            f'<g transform="translate({cx} {cy}) scale({sc}) translate(-17 -19)">'
            f'<g filter="url(#sh)">{g}</g></g>')
    filt = ('<defs><filter id="sh" x="-20%" y="-20%" width="140%" height="150%">'
            '<feDropShadow dx="0" dy="22" stdDeviation="22" flood-color="#111" flood-opacity="0.18"/></filter></defs>')
    body = (f'<rect width="{W}" height="{H}" fill="{PAPER}"/>{filt}{deco}'
            f'<g transform="translate({x0} 78) translate({n(-vb[0])} {n(-vb[1])})">{wm}</g>'
            f'{blk}{txt}<path d="{sub}" fill="#3A3834"/><path d="{url}" fill="{BLUE}"/>')
    return svg_doc((0, 0, W, H), body, "TalabaPass: talabalar uchun chegirmalar", W, H)


# ---------------------------------------------------------------- yig'ish
def write(name, text):
    p = os.path.join(OUT, name)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)
    return p


files = {}
wm, vb = wordmark()
files["talabapass-logo.svg"] = svg_doc(vb, wm, "TalabaPass")
wmw, vbw = wordmark(dark_text="#FFFFFF", pill="#FFFFFF", pill_text=BLUE)
files["talabapass-logo-white.svg"] = svg_doc(vbw, wmw, "TalabaPass")
files["talabapass-mark.svg"] = mark_svg(1024, rounded=True)
files["talabapass-icon-1024.svg"] = mark_svg(1024, rounded=False)
files["talabapass-adaptive-foreground.svg"] = mark_svg(1024, rounded=False, scale=0.92, transparent=True)
files["favicon.svg"] = mark_svg(512, rounded=True, scale=0.64, percent=False,
                                tw=600, th=420, rc=70, rn=52, t_h=290, badge=(246, 178), br=112)
files["talabapass-notification.svg"] = notification_svg(96)
files["og-image.svg"] = og_svg()
for k, v in files.items():
    write(k, v)

# ---- PNG render
def render(pw_page, svg_name, png_name, w, h, transparent=False, scale=1):
    svg = open(os.path.join(OUT, svg_name), encoding="utf-8").read()
    # SVG o'lchamini majburan sozlash
    import re
    svg = re.sub(r'<svg ([^>]*?)(width="[^"]*" )?(height="[^"]*" )?', lambda m: m.group(0), svg, count=1)
    html = (f'<html><body style="margin:0;background:transparent">'
            f'<div style="width:{w}px;height:{h}px">{svg.replace("<svg ", f"<svg style=\"width:{w}px;height:{h}px;display:block\" ", 1)}</div></body></html>')
    pw_page.set_viewport_size({"width": w, "height": h})
    pw_page.set_content(html)
    pw_page.wait_for_timeout(50)
    pw_page.screenshot(path=os.path.join(OUT, png_name), omit_background=transparent)


with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(device_scale_factor=1)
    render(pg, "talabapass-icon-1024.svg", "talabapass-icon-1024.png", 1024, 1024)
    render(pg, "talabapass-adaptive-foreground.svg", "talabapass-adaptive-foreground-1024.png", 1024, 1024, True)
    render(pg, "talabapass-mark.svg", "talabapass-mark-1024.png", 1024, 1024, True)
    render(pg, "talabapass-mark.svg", "icon-512.png", 512, 512, True)
    render(pg, "talabapass-mark.svg", "icon-192.png", 192, 192, True)
    render(pg, "talabapass-icon-1024.svg", "apple-touch-icon.png", 180, 180)
    for s in (16, 32, 48, 256):
        render(pg, "favicon.svg", f"favicon-{s}.png", s, s, True)
    render(pg, "talabapass-notification.svg", "talabapass-notification-96.png", 96, 96, True)
    render(pg, "og-image.svg", "og-image.png", 1200, 630)
    # logotip PNG (shaffof), kengligi 1200
    ratio = vb[3] / vb[2]
    render(pg, "talabapass-logo.svg", "talabapass-logo.png", 1200, round(1200 * ratio), True)
    render(pg, "talabapass-logo-white.svg", "talabapass-logo-white.png", 1200, round(1200 * ratio), True)
    # splash logotipi (oq, shaffof) 1024 kenglikda kvadrat kanvasda
    br.close()

# maskable icon (to'liq ko'k fon, xavfsiz zona ichida)
m = mark_svg(1024, rounded=False, scale=0.86)
write("icon-maskable-source.svg", m)
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page()
    render(pg, "icon-maskable-source.svg", "icon-maskable-512.png", 512, 512)
    br.close()
os.remove(os.path.join(OUT, "icon-maskable-source.svg"))

# favicon.ico (16/32/48)
ims = [Image.open(os.path.join(OUT, f"favicon-{s}.png")).convert("RGBA") for s in (16, 32, 48)]
big = Image.open(os.path.join(OUT, "favicon-256.png")).convert("RGBA")
big.save(os.path.join(OUT, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
# iOS ikonka alfa kanalsiz bo'lishi shart
for nme in ("talabapass-icon-1024.png", "apple-touch-icon.png"):
    p_ = os.path.join(OUT, nme)
    Image.open(p_).convert("RGB").save(p_)
print("tayyor:", sorted(os.listdir(OUT)))
