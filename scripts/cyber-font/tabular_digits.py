# Rend les chiffres de Rajdhani tabulaires : même chasse, glyphe centré. Renomme la famille (œuvre dérivée).
import sys
from fontTools.ttLib import TTFont
src, dst, family = sys.argv[1], sys.argv[2], sys.argv[3]
f = TTFont(src)
cmap = f.getBestCmap(); hmtx = f['hmtx']; glyf = f['glyf']
names = [cmap[ord(d)] for d in '0123456789']
width = max(hmtx[n][0] for n in names)
for n in names:
    adv, lsb = hmtx[n]
    dx = (width - adv) // 2
    g = glyf[n]
    if g.isComposite():
        for c in g.components: c.x += dx
    elif g.numberOfContours > 0:
        g.coordinates.translate((dx, 0))
    g.recalcBounds(glyf)
    hmtx[n] = (width, lsb + dx)
for rec in f['name'].names:
    if rec.nameID in (1, 4, 16):
        rec.string = rec.toUnicode().replace('Rajdhani', family)
    if rec.nameID == 6:
        rec.string = rec.toUnicode().replace('Rajdhani', family.replace(' ', ''))
f.flavor = 'woff2'
f.save(dst)
print(dst, width)
