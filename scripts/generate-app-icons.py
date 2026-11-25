#!/usr/bin/env python3
"""Gera ícones determinísticos do Prumo a partir de um único SVG.
Não usa imagens externas nem chaves. Requer CairoSVG e Pillow apenas no build.
"""
import json
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageColor
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

# A cor de cada borda deve coincidir com o fundo da abertura gerada pelo sistema.
manifest = json.loads((ROOT / "public/manifest.webmanifest").read_text(encoding="utf-8"))
background = ImageColor.getcolor(manifest["background_color"], "RGBA")
for icon in manifest["icons"]:
    path = ROOT / "public" / icon["src"].split("?")[0].lstrip("/")
    with Image.open(path).convert("RGBA") as im:
        w, h = im.size
        edges = ((0, 0, w, 1), (0, h - 1, w, h), (0, 0, 1, h), (w - 1, 0, w, h))
        for box in edges:
            edge = im.crop(box)
            if edge.getcolors(1) != [(edge.width * edge.height, background)]:
                raise ValueError(f"{path.name}: a borda do ícone difere do fundo da abertura")
Image.open(ROOT / "public/favicon.png").convert("RGBA").save(
    ROOT / "public/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)]
)
print("Gerados: maskable e favicon.ico")
