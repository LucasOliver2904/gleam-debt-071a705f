#!/usr/bin/env python3
"""Gera ícones determinísticos do Prumo a partir de um único SVG.
Não usa imagens externas nem chaves. Requer CairoSVG e Pillow apenas no build.
"""
import json
from io import BytesIO
from pathlib import Path
from xml.etree import ElementTree
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

# Margem transparente para o sistema compor a marca sobre a cor real da abertura.
mark = ElementTree.fromstring(svg)
tile = mark.find("./*[@id='tile-background']")
if tile is None:
    raise ValueError("Fundo do ícone não encontrado no SVG")
mark.remove(tile)
mark.set("viewBox", "-8 -8 144 144")
mark_svg = ElementTree.tostring(mark, encoding="utf-8")

manifest = json.loads((ROOT / "public/manifest.webmanifest").read_text(encoding="utf-8"))
background = ImageColor.getcolor(manifest["background_color"], "RGBA")
for icon in manifest["icons"]:
    path = ROOT / "public" / icon["src"].split("?")[0].lstrip("/")
    unmasked = icon["purpose"] == "any"
    width, height = map(int, icon["sizes"].split("x"))
    raw = cairosvg.svg2png(bytestring=mark_svg, output_width=width, output_height=height)
    with Image.open(BytesIO(raw)) as rendered:
        artwork = rendered.convert("RGBA")
        if not unmasked:
            tile_image = Image.new("RGBA", artwork.size, background)
            tile_image.alpha_composite(artwork)
            artwork = tile_image
        artwork.save(path, "PNG", optimize=True)
    with Image.open(path).convert("RGBA") as image:
        if image.size != (width, height):
            raise ValueError(f"{path.name}: dimensões diferentes do manifesto")
        alpha = image.getchannel("A")
        if unmasked:
            bounds = alpha.getbbox()
            if not bounds or min(bounds[0], bounds[1], width - bounds[2], height - bounds[3]) < min(width, height) // 8:
                raise ValueError(f"{path.name}: a marca precisa de margem transparente")
        else:
            if alpha.getextrema() != (255, 255):
                raise ValueError(f"{path.name}: o ícone adaptativo precisa ser opaco")
            edges = ((0, 0, width, 1), (0, height - 1, width, height),
                     (0, 0, 1, height), (width - 1, 0, width, height))
            for box in edges:
                edge = image.crop(box)
                if edge.getcolors(1) != [(edge.width * edge.height, background)]:
                    raise ValueError(f"{path.name}: a borda difere do fundo da abertura")
Image.open(ROOT / "public/favicon.png").convert("RGBA").save(
    ROOT / "public/favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)]
)
print("Gerados: marca transparente, ícone adaptativo e favicon.ico")
