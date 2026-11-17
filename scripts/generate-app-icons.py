#!/usr/bin/env python3
"""Gera ícones determinísticos do Prumo a partir de um único SVG.
Não usa imagens externas nem chaves. Requer CairoSVG e Pillow apenas no build.
"""
from io import BytesIO
from pathlib import Path
from PIL import Image
import cairosvg

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public/icons/icon.svg"
svg = SOURCE.read_text(encoding="utf-8")
out = {
    "public/favicon.png": 64,
    "public/apple-touch-icon.png": 180,
    "public/icons/icon-192.png": 192,
    "public/icons/icon-512.png": 512,
    "src/assets/app-icon.png": 512,
}
for path, size in out.items():
    raw = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    img = Image.open(BytesIO(raw)).convert("RGBA")
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    img.save(target, "PNG", optimize=True)
    print(f"Gerado: {target.relative_to(ROOT)} ({size}×{size})")

# Sem moldura/inset: fundo teal preenche toda a máscara do Android.
maskable = Image.open(BytesIO(cairosvg.svg2png(
    bytestring=svg.encode(), output_width=512, output_height=512
))).convert("RGBA")
maskable.save(ROOT / "public/icons/icon-maskable-512.png", "PNG", optimize=True)

# Regressão de bordas: sem pixels pretos nem transparência nos cantos.
for path in ("public/icons/icon-192.png", "public/icons/icon-512.png", "public/icons/icon-maskable-512.png"):
    im = Image.open(ROOT / path).convert("RGBA")
    w, h = im.size
    for pos in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
                (0, h // 2), (w - 1, h // 2), (w // 2, 0), (w // 2, h - 1)):
        r, g, b, a = im.getpixel(pos)
        if a != 255 or g < 55 or b < 55:
            raise ValueError(f"{path}: borda escura ou transparente {pos}: {(r,g,b,a)}")
Image.open(ROOT / "public/favicon.png").convert("RGBA").save(
    ROOT / "public/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)]
)
print("Gerados: maskable e favicon.ico")
