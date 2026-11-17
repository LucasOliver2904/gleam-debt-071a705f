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

# O Android aplica máscaras circulares: o símbolo precisa caber na área segura.
# Fundo preenchido até a borda e arte centralizada em 75% do canvas.
maskable = Image.new("RGBA", (512, 512), "#07131A")
foreground_png = cairosvg.svg2png(bytestring=svg.encode(), output_width=384, output_height=384)
foreground = Image.open(BytesIO(foreground_png)).convert("RGBA")
maskable.alpha_composite(foreground, (64, 64))
maskable.save(ROOT / "public/icons/icon-maskable-512.png", "PNG", optimize=True)
Image.open(ROOT / "public/favicon.png").convert("RGBA").save(
    ROOT / "public/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)]
)
print("Gerados: maskable e favicon.ico")
