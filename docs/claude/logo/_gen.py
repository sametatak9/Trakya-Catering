# Trakya Catering logo generator: marks + outlined wordmarks (fontTools) -> SVG, cairosvg -> PNG
import os, io
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import cairosvg

OUT = os.path.dirname(os.path.abspath(__file__))
TERRA, TERRA_D, SUN, SUN_D, INK, CREAM = '#B4432A', '#8F3320', '#E9A822', '#C98A12', '#221F1B', '#FBF8F2'
TERRA_L = '#E0694E'  # koyu zeminde kiremit
FONTS = {}
def font(path, **axes):
    key = (path, tuple(sorted(axes.items())))
    if key not in FONTS:
        f = TTFont(path)
        if 'fvar' in f: f = instancer.instantiateVariableFont(f, axes)
        FONTS[key] = f
    return FONTS[key]
G = '/usr/share/fonts/truetype/sand-box/google/'
OUTFIT = G + 'Outfit/Outfit-VariableFont_wght.ttf'
FRAUN = G + 'Fraunces/Fraunces-VariableFont_SOFT,WONK,opsz,wght.ttf'

def text_path(f, text, size, x, y, tracking=0.0):
    """returns (svg path d, width). tracking in em."""
    gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm
    s = size / upm; pen = SVGPathPen(gs); cx = 0.0
    kern = {}
    for i, ch in enumerate(text):
        gname = cmap.get(ord(ch))
        if gname is None: cx += size*0.3; continue
        tp = TransformPen(pen, (s, 0, 0, -s, x + cx, y))
        gs[gname].draw(tp)
        cx += gs[gname].width * s + (tracking*size if i < len(text)-1 else 0)
    return pen.getCommands(), cx

# ---------- marks (100x100 box) ----------
def grain(x, y, ang, L, w, color):
    return f'<path d="M0 {-L/2:.2f} Q{w:.2f} 0 0 {L/2:.2f} Q{-w:.2f} 0 0 {-L/2:.2f} Z" transform="translate({x:.2f} {y:.2f}) rotate({ang})" fill="{color}"/>'

def wheat(cx, top, bottom, color, scale=1.0):
    s = scale
    parts = [f'<path d="M{cx} {bottom} C{cx} {bottom-8*s} {cx} {top+14*s} {cx} {top+8*s}" stroke="{color}" stroke-width="{2.4*s}" stroke-linecap="round" fill="none"/>']
    L, w = 11.5*s, 4.6*s
    ys = [bottom - 7*s, bottom - 14.5*s, bottom - 22*s]
    for i, y in enumerate(ys):
        for side in (-1, 1):
            parts.append(grain(cx + side*4.3*s, y, side*30, L*(1-0.06*i), w, color))
    parts.append(grain(cx, top + 6*s, 0, L*0.95, w*0.95, color))
    return ''.join(parts)

def mark1(dome, plate, hl, grain):
    # cloche (servis kapağı) + başak
    return (f'<rect x="8" y="74" width="84" height="8" rx="4" fill="{plate}"/>'
            f'<path d="M15 70 A35 35 0 0 1 85 70 Z" fill="{dome}"/>'
            f'<path d="M27 58 A24 24 0 0 1 41 41" stroke="{hl}" stroke-width="4.2" stroke-linecap="round" fill="none"/>'
            + wheat(50, 1, 36, grain, 1.08))

def mark2(ring, fork, bg=None):
    # C = tabak kenarı (açık halka), T = çatal
    import math
    r = 36; a0, a1 = math.radians(48), math.radians(312)
    x0, y0 = 50 + r*math.cos(a0), 50 - r*math.sin(a0)
    x1, y1 = 50 + r*math.cos(a1), 50 - r*math.sin(a1)
    c = f'<path d="M{x0:.2f} {y0:.2f} A{r} {r} 0 1 0 {x1:.2f} {y1:.2f}" stroke="{ring}" stroke-width="12.5" stroke-linecap="round" fill="none"/>'
    tines = ''.join(f'<rect x="{x-1.9:.2f}" y="22" width="3.8" height="17" rx="1.9" fill="{fork}"/>' for x in (40.5, 47, 53, 59.5))
    body = f'<path d="M38.6 36 H61.4 V41 C61.4 47.5 56.5 51 53 52 V76 A3 3 0 0 1 47 76 V52 C43.5 51 38.6 47.5 38.6 41 Z" fill="{fork}"/>'
    return c + tines + body

def petal(angle, r0, r1, w, color):
    return (f'<path d="M0 {-r0} C{w} {-(r0+r1)/2} {w*0.6} {-r1+3} 0 {-r1} C{-w*0.6} {-r1+3} {-w} {-(r0+r1)/2} 0 {-r0} Z" '
            f'transform="translate(50 50) rotate({angle})" fill="{color}"/>')

def mark3(p1, p2, plate, rim, dot):
    s = ''.join(petal(i*30 + 15, 21, 43, 9.5, p2) for i in range(12))
    s += ''.join(petal(i*30, 21, 48, 10.5, p1) for i in range(12))
    s += f'<circle cx="50" cy="50" r="27" fill="{plate}"/>'
    s += f'<circle cx="50" cy="50" r="21" fill="none" stroke="{rim}" stroke-width="1.6" opacity=".55"/>'
    s += (f'<g fill="{dot}" transform="translate(50 50) scale(1.25) translate(-50 -50)"><rect x="41.9" y="38" width="2.3" height="8.5" rx="1.15"/><rect x="45.6" y="38" width="2.3" height="8.5" rx="1.15"/>'
          f'<path d="M41.3 44.5 H48.5 V46.6 C48.5 49 47 50.2 46.1 50.5 V61.2 A1.2 1.2 0 0 1 43.7 61.2 V50.5 C42.8 50.2 41.3 49 41.3 46.6 Z"/>'
          f'<ellipse cx="55.2" cy="42.8" rx="3.5" ry="5.3"/><rect x="54" y="46.5" width="2.4" height="15.9" rx="1.2"/></g>')
    return s

MARKS = {
  1: dict(light=lambda: mark1(TERRA, INK, '#F7E4DE', SUN), dark=lambda: mark1(TERRA_L, CREAM, '#FFD9CC', SUN),
          icon_bg=TERRA, icon=lambda: mark1(CREAM, CREAM, '#F2C9BC', SUN)),
  2: dict(light=lambda: mark2(TERRA, SUN_D), dark=lambda: mark2(TERRA_L, SUN),
          icon_bg=TERRA, icon=lambda: mark2(CREAM, SUN)),
  3: dict(light=lambda: mark3(SUN, SUN_D, TERRA, CREAM, CREAM), dark=lambda: mark3(SUN, '#F2BC45', TERRA_L, CREAM, CREAM),
          icon_bg=INK, icon=lambda: mark3(SUN, SUN_D, TERRA, CREAM, CREAM)),
}

def wordmark(opt, dark):
    ink = CREAM if dark else INK
    sub = ('#F2BC45' if dark else TERRA) if opt != 2 else ('#F2BC45' if dark else TERRA)
    if opt == 1:
        f1 = font(FRAUN, wght=620, opsz=72, SOFT=50, WONK=0); f2 = font(OUTFIT, wght=600)
        d1, w1 = text_path(f1, 'Trakya', 50, 0, 44, -0.005)
        d2, w2 = text_path(f2, 'CATERING', 13.2, 2, 68, 0.42)
        return f'<path d="{d1}" fill="{ink}"/><path d="{d2}" fill="{sub}"/>', max(w1, w2+2), 72
    if opt == 2:
        f1 = font(OUTFIT, wght=750); f2 = font(OUTFIT, wght=500)
        d1, w1 = text_path(f1, 'TRAKYA', 40, 0, 42, 0.06)
        d2, w2 = text_path(f2, 'CATERING · TOPLU YEMEK', 11.2, 1, 64, 0.26)
        return f'<path d="{d1}" fill="{ink}"/><path d="{d2}" fill="{sub}"/>', max(w1, w2+1), 70
    f1 = font(OUTFIT, wght=650); f2 = font(OUTFIT, wght=400)
    d1, w1 = text_path(f1, 'trakya', 48, 0, 42, -0.01)
    d2, w2 = text_path(f2, 'catering', 23, 1.5, 68, 0.12)
    return f'<path d="{d1}" fill="{ink}"/><path d="{d2}" fill="{sub}"/>', max(w1, w2+1.5), 72

def horizontal(opt, dark):
    m = MARKS[opt]['dark' if dark else 'light']()
    wm, ww, wh = wordmark(opt, dark)
    H = 100; mark_size = 84; gap = 18; pad = 8
    tx = pad + mark_size + gap; ty = (H - wh) / 2 + 2
    W = tx + ww + pad
    bg = ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H}" width="{W*2:.0f}" height="{H*2}" role="img" aria-label="Trakya Catering">'
            f'<title>Trakya Catering</title>{bg}<g transform="translate({pad} {(H-mark_size)/2}) scale({mark_size/100})">{m}</g>'
            f'<g transform="translate({tx:.1f} {ty:.1f})">{wm}</g></svg>')

def icon(opt, rx=22, scale=.72):
    m = MARKS[opt]
    ty = {1: 50 - 41.5*scale}.get(opt, 50 - 50*scale); tx = 50 - 50*scale
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512" role="img" aria-label="Trakya Catering">'
            f'<rect width="100" height="100" rx="{rx}" fill="{m["icon_bg"]}"/>'
            f'<g transform="translate({tx:.2f} {ty:.2f}) scale({scale})">{m["icon"]()}</g></svg>')

def mark_only(opt):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">{MARKS[opt]["light"]()}</svg>'

def png(svg, path, w=None):
    cairosvg.svg2png(bytestring=svg.encode(), write_to=path, output_width=w)

if __name__ == '__main__':
    for o in (1, 2, 3):
        files = {f'logo-{o}-yatay.svg': horizontal(o, False), f'logo-{o}-yatay-koyu.svg': horizontal(o, True),
                 f'logo-{o}-ikon.svg': icon(o), f'logo-{o}-isaret.svg': mark_only(o)}
        for n, s in files.items():
            open(os.path.join(OUT, n), 'w').write(s)
        png(files[f'logo-{o}-ikon.svg'], os.path.join(OUT, f'logo-{o}-ikon-512.png'), 512)
        png(files[f'logo-{o}-yatay.svg'], os.path.join(OUT, f'logo-{o}-yatay.png'), 1200)
    # Seçenek 1 için uygulama paketi (favicon, PWA, apple-touch, maskable)
    P = os.path.join(OUT, 'pwa-secenek-1'); os.makedirs(P, exist_ok=True)
    open(os.path.join(P, 'favicon.svg'), 'w').write(icon(1))
    for sz in (16, 32, 48): png(icon(1), os.path.join(P, f'favicon-{sz}.png'), sz)
    png(icon(1, rx=0), os.path.join(P, 'apple-touch-icon-180.png'), 180)
    png(icon(1), os.path.join(P, 'icon-192.png'), 192); png(icon(1), os.path.join(P, 'icon-512.png'), 512)
    png(icon(1, rx=0, scale=.58), os.path.join(P, 'icon-maskable-512.png'), 512)
    open(os.path.join(P, 'icon-maskable.svg'), 'w').write(icon(1, rx=0, scale=.58))
    print('ok')
