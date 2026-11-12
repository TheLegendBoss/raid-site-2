import sys; sys.path.insert(0,'.')
from guns import *
import anatomy
VS=1.14
CW,CH=780,360
F='font-family="DejaVu Sans Mono,monospace"'
def card(d):
    minx,miny,maxx,maxy=d['bbox']; w=maxx-minx; h=(maxy-miny)*VS
    s=min(520/w,222/h); ox=24+(520-w*s)/2-minx*s; oy=84+(222-h*s)/2-miny*s*VS
    o=f'<path d="M12 1H{CW-1}V{CH-12}L{CW-12} {CH-1}H1V12Z" fill="#070d0e" stroke="#2a4a45" stroke-width="1.4"/>'
    o+=f'<text x="24" y="34" {F} font-size="17" font-weight="700" letter-spacing="3" fill="#bfeee2">{d["name"]}</text>'
    o+=f'<text x="24" y="54" {F} font-size="10" letter-spacing="1.3" fill="#5d8a82">{d["sub"]}</text>'
    o+=f'<line x1="24" y1="64" x2="{CW-24}" y2="64" stroke="#1c3733"/>'
    o+=f'<g class="o" transform="translate({ox:.2f} {oy:.2f}) scale({s:.4f} {s*VS:.4f})">{d["svg"]}</g>'
    for (lx,ly,t) in d['labels']:
        o+=f'<text x="{ox+lx*s:.1f}" y="{oy+ly*s*VS:.1f}" {F} font-size="8.5" fill="#7fa8a0">{t}</text>'
    # scale bar
    o+=f'<line x1="24" y1="{CH-26}" x2="{24+100*s:.1f}" y2="{CH-26}" stroke="#9fe8d2" stroke-width="1.4"/><line x1="24" y1="{CH-30}" x2="24" y2="{CH-22}" stroke="#9fe8d2"/><line x1="{24+100*s:.1f}" y1="{CH-30}" x2="{24+100*s:.1f}" y2="{CH-22}" stroke="#9fe8d2"/>'
    o+=f'<text x="{24+100*s+8:.1f}" y="{CH-22}" {F} font-size="9" fill="#5d8a82">100 mm</text>'
    if d['magf']:
        msvg,mw,mh=d['magf']()
        m=min(3.2,160/(mw*s),214/(mh*s))
        ms=s*m
        mx=560+(200-mw*ms)/2; my=84+(222-mh*ms)/2
        o+=f'<line x1="552" y1="76" x2="552" y2="{CH-16}" stroke="#1c3733"/>'
        o+=f'<g class="o" transform="translate({mx:.1f} {my:.1f}) scale({ms:.4f})">{msvg}</g>'
        o+=f'<text x="560" y="84" {F} font-size="9" fill="#5d8a82">MAGAZINE  x{m:.1f}</text>'
    else:
        o+=f'<line x1="552" y1="76" x2="552" y2="{CH-16}" stroke="#1c3733"/><text x="566" y="150" {F} font-size="9" fill="#5d8a82">TUBE MAGAZINE</text><text x="566" y="166" {F} font-size="9" fill="#5d8a82">shells shown in x-ray</text><text x="566" y="182" {F} font-size="9" fill="#5d8a82">inside the barrel tube</text>'
    return o
cols=2; rows=4
Wt=cols*CW+(cols+1)*16; Ht=rows*CH+(rows+1)*16+10
body=''
for i,f in enumerate(GUNS):
    x=16+(i%cols)*(CW+16); y=16+(i//cols)*(CH+16)
    anatomy._VS[0]=VS; d=f(); anatomy._VS[0]=1.0
    body+=f'<g transform="translate({x} {y})">{card(d)}</g>'
svg=f'<svg xmlns="http://www.w3.org/2000/svg" width="{Wt}" height="{Ht}" viewBox="0 0 {Wt} {Ht}"><style>.o *{{vector-effect:non-scaling-stroke}}</style><rect width="100%" height="100%" fill="#030606"/>{body}</svg>'
open('starters.svg','w').write(svg); print(Wt,Ht)
