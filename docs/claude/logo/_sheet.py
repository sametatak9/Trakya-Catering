import re, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from _gen import *
from fontTools.pens.svgPathPen import SVGPathPen
def nest(svg, x, y, w=None, h=None):
    vb = re.search(r'viewBox="([^"]+)"', svg).group(1); vw, vh = map(float, vb.split()[2:])
    if w and not h: h = w*vh/vw
    if h and not w: w = h*vw/vh
    inner = re.sub(r'^<svg[^>]*>', '', svg)[:-6]
    return f'<svg x="{x}" y="{y}" width="{w}" height="{h}" viewBox="{vb}">{inner}</svg>'
W, RH = 1800, 330
lab = font(OUTFIT, wght=600); lab2 = font(OUTFIT, wght=400)
names = {1: 'Seçenek 1 — Servis kapağı + başak', 2: 'Seçenek 2 — TC monogram (tabak + çatal)', 3: 'Seçenek 3 — Ayçiçeği tabak'}
parts = [f'<rect width="{W}" height="{RH*3+80}" fill="#FFFFFF"/>']
d, _ = text_path(lab, 'Trakya Catering — logo seçenekleri (Hasat 2.0: kiremit #B4432A · ayçiçeği #E9A822)', 26, 40, 50)
parts.append(f'<path d="{d}" fill="#221F1B"/>')
for i, o in enumerate((1, 2, 3)):
    y0 = 80 + i*RH
    d, _ = text_path(lab, names[o], 20, 40, y0+30); parts.append(f'<path d="{d}" fill="#857B6D"/>')
    parts.append(f'<rect x="40" y="{y0+50}" width="760" height="250" rx="20" fill="#FBF8F2" stroke="#EAE3D6"/>')
    parts.append(nest(horizontal(o, False), 80, y0+105, h=140))
    parts.append(f'<rect x="820" y="{y0+50}" width="560" height="250" rx="20" fill="#1C1914"/>')
    parts.append(nest(horizontal(o, True), 850, y0+120, w=500))
    parts.append(nest(icon(o), 1410, y0+60, w=190))
    for k, s in enumerate((64, 32, 16)):
        parts.append(nest(icon(o), 1620 + [0, 80, 128][k], y0+60, w=s))
    parts.append(nest(mark_only(o), 1620, y0+160, w=120))
svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {RH*3+80}" width="{W}" height="{RH*3+80}">' + ''.join(parts) + '</svg>'
open(os.path.join(OUT, '_sheet.svg'), 'w').write(svg)
cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(os.path.dirname(OUT), 'logo-secenekleri.png'))
print('ok')
