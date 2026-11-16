"""
Archivo statik nusxalariga (assets/fonts) Golos Text kirill glifllarini qo'shadi.

Archivo'da kirill yo'q, React Native esa CSS kabi glif bo'yicha boshqa shriftga o'tmaydi (dizayn:
font-family: 'Archivo', 'Golos Text'). Shuning uchun har bir Archivo-<og'irlik>-<kenglik>.ttf ga Golos Text'ning
shu og'irlikdagi kirill glifllari qo'shiladi: lotin, raqam va belgilar Archivo'dan qoladi, kirill — Golos'dan
(kenglik o'qi yo'q — 62/112 nusxalarda ham oddiy kenglik, brauzerdagi fallback bilan bir xil). Kerning kirill uchun yo'q.

Ishlatish (fontTools kerak: pip install fonttools):
  python mobile/scripts/fonts-cyrillic.py <GolosText[wght].ttf>
Manba: https://github.com/google/fonts/tree/main/ofl/golostext (OFL, assets/fonts/OFL-GolosText.txt).
Kirill allaqachon bor fayl o'tkazib yuboriladi (qayta ishga tushirish xavfsiz).
"""

import pathlib
import re
import sys

from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

FONTS = pathlib.Path(__file__).resolve().parent.parent / "assets" / "fonts"
# Kirill, kirill qo'shimchasi, kengaytmalar (o'zbek kirill: Ўў Ққ Ғғ Ҳҳ)
RANGES = [(0x0400, 0x052F), (0x1C80, 0x1C8F), (0x2DE0, 0x2DFF), (0xA640, 0xA69F)]


def in_ranges(cp: int) -> bool:
    return any(lo <= cp <= hi for lo, hi in RANGES)


def merge(target: pathlib.Path, golos: TTFont) -> int:
    font = TTFont(target)
    cmap = font.getBestCmap()
    if any(in_ranges(cp) for cp in cmap):
        return 0
    src_cmap = golos.getBestCmap()
    src_glyphs = golos.getGlyphSet()
    glyf = font["glyf"]
    hmtx = font["hmtx"]
    order = list(font.getGlyphOrder())
    added = {}
    for cp, name in sorted(src_cmap.items()):
        if not in_ranges(cp) or cp in cmap:
            continue
        new_name = f"uni{cp:04X}.golos"
        if new_name not in added:
            # Komponentlar (Ё = Е + ¨) yoyiladi — Archivo'dagi bir xil nomli glifllarga bog'lanib qolmasin
            recording = DecomposingRecordingPen(src_glyphs)
            src_glyphs[name].draw(recording)
            pen = TTGlyphPen(None)
            recording.replay(pen)
            glyph = pen.glyph()
            glyph.recalcBounds(glyf)
            glyf.glyphs[new_name] = glyph
            advance = golos["hmtx"][name][0]
            hmtx[new_name] = (advance, getattr(glyph, "xMin", 0))
            order.append(new_name)
            added[new_name] = cp
    font.setGlyphOrder(order)
    glyf.glyphOrder = order
    for table in font["cmap"].tables:
        if table.isUnicode():
            for new_name, cp in added.items():
                if table.format == 4 and cp > 0xFFFF:
                    continue
                table.cmap[cp] = new_name
    font["maxp"].numGlyphs = len(order)
    font.save(target)
    return len(added)


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    source = TTFont(sys.argv[1])
    cache: dict[int, TTFont] = {}
    for path in sorted(FONTS.glob("Archivo-*.ttf")):
        match = re.match(r"Archivo-(\d+)-\d+\.ttf$", path.name)
        if not match:
            continue
        weight = int(match.group(1))
        if weight not in cache:
            cache[weight] = instantiateVariableFont(TTFont(sys.argv[1]) if cache else source, {"wght": weight})
        count = merge(path, cache[weight])
        print(f"{path.name}: {count} ta glif qo'shildi" if count else f"{path.name}: kirill bor, o'tkazildi")


if __name__ == "__main__":
    main()
