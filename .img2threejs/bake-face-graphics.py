"""Bake observed, de-lit facial graphics into the procedural head's front UV chart.

This is source-pixel reuse on a continuous 3D head, not a character billboard.
The source crop is normalized by +8 degrees to remove the observed eye-line tilt.
UV chart source bounds: x=365..553, y=10..212 in the normalized reference.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import json
import hashlib

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / '.img2threejs/face-delit.png'
image = Image.open(SOURCE).convert('RGB')
skin = image.getpixel((67, 61))
canvas = Image.new('RGB', (188, 202), skin)
mask = Image.new('L', image.size, 0)
draw = ImageDraw.Draw(mask)
# Source-derived eye/lash, eyebrow and mouth regions; unobserved skin stays flat.
for bounds in [(18, 17, 56, 55), (78, 17, 116, 55),
               (22, 3, 52, 15), (83, 5, 112, 17), (47, 70, 89, 99)]:
    draw.ellipse(bounds, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(1.3))
canvas.paste(image, (25, 75), mask)
canvas.resize((512, 512), Image.Resampling.LANCZOS).save(ROOT / 'public/companion/face-albedo.png')
report = {
    'source': '.img2threejs/face-delit.png',
    'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    'output': 'public/companion/face-albedo.png',
    'chart': {'referenceX': [365, 553], 'referenceY': [10, 212], 'rotationDegrees': 8},
    'skinRGB': skin,
    'method': 'Observed facial graphics camera-baked into front XY UVs; neutral skin palette elsewhere.',
    'limits': ['Graphic albedo only; no inferred normal, roughness or physical skin evidence.',
               'Hidden face sides/back use neutral continued skin palette.',
               'Not an animation or expression readiness claim.']
}
(ROOT / '.img2threejs/face-graphics-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
print(json.dumps(report, ensure_ascii=False))
