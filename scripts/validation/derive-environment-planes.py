"""Reproducible masks of the existing local authored horizon; no external images.
Run with Pillow in a proof-only Python environment (not an app dependency).
Preserves the source JPG. Coordinates refer to its 1376x768 authored composition.
Masks separate celestial silhouettes and the near rock shelf for real plane motion.
"""
from pathlib import Path
import hashlib
from PIL import Image, ImageDraw, ImageFilter

root = Path(__file__).resolve().parents[2]
assets = root / 'src/ui/presentation/rebuild/assets'
source = assets / 'first-person-cosmic-horizon.jpg'
assert hashlib.sha256(source.read_bytes()).hexdigest() == 'e9f087201c2f061a8154bfd818fb1348da849a43dc835b2d150628d627e33fd4'
image = Image.open(source).convert('RGBA')
assert image.size == (1376, 768)

celestial = Image.new('L', image.size)
draw = ImageDraw.Draw(celestial)
draw.ellipse((889, -49, 1279, 355), fill=255)
draw.polygon([(745, 377), (805, 304), (1279, 0), (1347, 0), (1016, 275), (827, 373)], fill=255)
draw.ellipse((1222, 221, 1264, 266), fill=255)

rocks = Image.new('L', image.size)
ImageDraw.Draw(rocks).polygon([(0, 276), (32, 321), (69, 352), (83, 445), (128, 522),
 (151, 583), (216, 603), (251, 674), (330, 697), (407, 643), (457, 670),
 (537, 652), (611, 622), (659, 611), (714, 584), (759, 605), (792, 582),
 (834, 596), (880, 580), (909, 521), (956, 502), (995, 495), (1069, 479),
 (1127, 490), (1160, 487), (1212, 456), (1250, 418), (1282, 398),
 (1310, 356), (1340, 368), (1376, 346), (1376, 768), (0, 768)], fill=255)

for name, mask in [('celestial-plane', celestial), ('near-rocks-plane', rocks)]:
    out = image.copy()
    out.putalpha(mask.filter(ImageFilter.GaussianBlur(2)))
    path = assets / (name + '.webp')
    out.save(path, quality=86, method=6)
    print(name, path.stat().st_size, hashlib.sha256(path.read_bytes()).hexdigest())
