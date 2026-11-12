"""Shared firearm anatomy (side view, millimetres). Bore axis is y=0, +x is toward the muzzle, y grows downward.
Every gun is built from the same helpers so grips, guards, triggers, ports and ammo obey the same rules."""
import math
OUT='#9fe8d2'; FILL='#0a1112'; DIM='#4f7c74'; AMB='#ffb347'; BR='#d8b04a'; CU='#c9703a'; RED='#c0463a'; TXT='#7fa8a0'

def path(d,fill=FILL,stroke=OUT,sw=1.3,dash=None):
    da=f' stroke-dasharray="{dash}"' if dash else ''
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round"{da}/>'
def poly(pts,**k):
    return path('M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in pts)+' Z',**k)
def line(pts,**k):
    return path('M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in pts),fill='none',**k)
def box(x,y,w,h,c=0,**k):
    if c<=0: return poly([(x,y),(x+w,y),(x+w,y+h),(x,y+h)],**k)
    return poly([(x+c,y),(x+w-c,y),(x+w,y+c),(x+w,y+h-c),(x+w-c,y+h),(x+c,y+h),(x,y+h-c),(x,y+c)],**k)

# ---------------------------------------------------------------- ammunition (nose toward +x)
CAL={ # case length, case dia, neck dia, bullet dia, overall length, shoulder start (fraction of case), rim dia
 '9mm':  dict(Lc=19,   d=9.9,  nd=9.4,  bd=9.0, oal=29.7, sh=1.0,  rim=10.0, og=7),
 'mag':  dict(Lc=32.6, d=13.6, nd=13.0, bd=12.7,oal=40.9, sh=1.0,  rim=13.9, og=9),
 '556':  dict(Lc=45,   d=9.6,  nd=6.4,  bd=5.7, oal=57.0, sh=.70,  rim=9.6,  og=14),
 '762':  dict(Lc=51,   d=11.9, nd=8.6,  bd=7.8, oal=70.0, sh=.74,  rim=11.9, og=17),
}
def cartridge(kind,x0,yc,rot=0,hot=False,spent=False):
    c=CAL[kind]; Lc,d,nd,bd,oal,sh,rim,og=[c[k] for k in ('Lc','d','nd','bd','oal','sh','rim','og')]
    r=d/2; n=nd/2; b=bd/2
    top=[(0,-rim/2),(1.2,-rim/2),(1.2,-r),(Lc*sh,-r),(Lc,-n)]
    case=top+[(x,-y) for x,y in reversed(top)]
    case_d='M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in case)+' Z'
    bul=f'M{Lc-1:.2f} {-b:.2f} L{oal-og:.2f} {-b:.2f} Q{oal-og*.35:.2f} {-b*.92:.2f} {oal:.2f} {-b*.28:.2f} L{oal:.2f} {b*.28:.2f} Q{oal-og*.35:.2f} {b*.92:.2f} {oal-og:.2f} {b:.2f} L{Lc-1:.2f} {b:.2f} Z'
    if spent:  # empty case: open mouth, no bullet
        mouth=f'<ellipse cx="{Lc:.2f}" cy="0" rx="1.1" ry="{n:.2f}" fill="#000" stroke="{BR}" stroke-width="1"/>'
        return (f'<g transform="translate({x0:.2f} {yc:.2f}) rotate({rot:.2f})">'+path(case_d,stroke=BR,sw=1)+mouth+'</g>')
    return (f'<g transform="translate({x0:.2f} {yc:.2f}) rotate({rot:.2f})">'+path(bul,stroke=CU,sw=1)+path(case_d,stroke=('#fff2c2' if hot else BR),sw=1)+'</g>')
def shell12(x0,yc,rot=0):
    top=[(0,-11.4),(1.8,-11.4),(1.8,-10.7),(17,-10.7)]
    head='M'+' L'.join(f'{x:.2f} {y:.2f}' for x,y in top+[(x,-y) for x,y in reversed(top)])+' Z'
    hull=f'M17 -10.2 L66 -10.2 Q70 -8.8 70 -5 L70 5 Q70 8.8 66 10.2 L17 10.2 Z'
    return (f'<g transform="translate({x0:.2f} {yc:.2f}) rotate({rot:.2f})">'+path(hull,stroke=RED,sw=1)+path(head,stroke=BR,sw=1)+'</g>')
def rd(kind): return CAL[kind]['d']
def oal(kind): return 70 if kind=='12ga' else CAL[kind]['oal']

# ---------------------------------------------------------------- grip / guard / trigger rules
class Grip:
    """Pistol grip hung under the receiver. (ax,ay) backstrap top, (bx,by) front strap top, length L, rake degrees from vertical (bottom rakes rearward)."""
    def __init__(s,ax,ay,bx,by,L,rake):
        s.ax,s.ay,s.bx,s.by,s.L=ax,ay,bx,by,L
        s.dx,s.dy=-math.sin(math.radians(rake)),math.cos(math.radians(rake))
        s.a2=(ax+L*s.dx,ay+L*s.dy); s.b2=(bx+L*s.dx,by+L*s.dy)
    def front_x(s,y): return s.bx+(y-s.by)*s.dx/s.dy
    def back_x(s,y): return s.ax+(y-s.ay)*s.dx/s.dy
    def draw(s):
        a2,b2=s.a2,s.b2; t=3
        pts=[(s.ax,s.ay),(s.bx,s.by),b2,(b2[0]-t,b2[1]+0),(a2[0]+t,a2[1]),a2]
        out=poly([(s.ax,s.ay),(s.bx,s.by),b2,a2])
        # texture: three short grip ticks on the backstrap side and the base cap
        for f in (.35,.5,.65):
            y=s.ay+(s.by-s.ay)*0+s.L*s.dy*f
            out+=line([(s.back_x(y)+5,y),(s.back_x(y)+11,y)],stroke=DIM,sw=1)
        return out
    def inner(s,inset=3.5,top=14,bottom=0):
        """polygon inside the grip where the magazine lives (dashed)."""
        y0=s.ay+top; y1=s.ay+s.L*s.dy-bottom
        return (s.back_x(y0)+inset,y0),(s.front_x(y0)-inset,y0),(s.front_x(y1)-inset,y1),(s.back_x(y1)+inset,y1)

def guard_and_trigger(g,frame_y,trig_gap=25,front_gap=34,depth=34,t=5):
    """Trigger blade 25 mm ahead of the front strap, guard anchored to the frame and the strap with finger room."""
    ty=frame_y+13
    tx=g.front_x(ty)+trig_gap
    gf=tx+front_gap; gb=frame_y+depth
    sx=g.front_x(gb); six=g.front_x(gb-t)
    outer=f'M{gf:.1f} {frame_y} L{gf:.1f} {gb-12} Q{gf:.1f} {gb} {gf-12:.1f} {gb} L{sx+10:.1f} {gb} Q{sx+2:.1f} {gb} {sx:.1f} {gb-4}'
    inner=f' L{six:.1f} {gb-t} L{six+10:.1f} {gb-t} L{gf-t-10:.1f} {gb-t} Q{gf-t:.1f} {gb-t} {gf-t:.1f} {gb-t-10} L{gf-t:.1f} {frame_y} Z'
    guard=path(outer+inner)
    trig=poly([(tx,frame_y),(tx+7,frame_y),(tx+5,frame_y+11),(tx-1,frame_y+25),(tx-7,frame_y+23),(tx-2,frame_y+10)])
    return guard+trig,(tx,gf,gb)

def port(x,y,length,height):
    return path(f'M{x} {y} h{length} v{height} h{-length} Z',fill='none',stroke=AMB,sw=1)
def vents(x,y,w,h,n,gap):
    return ''.join(box(x+i*gap,y,w,h,c=min(w,h)/2-.01,fill='#000',stroke=DIM,sw=1) for i in range(n))

# ---------------------------------------------------------------- magazines (rounds lie nose-forward, stacked)
def box_mag(kind,n,x,y_top,stack='double',follower=True):
    """Straight box magazine. x is the rear wall, y_top the feed lips. Returns svg, (w,h)."""
    d=rd(kind); L=oal(kind); pitch=d*.5 if stack=='double' else d*1.02
    off=3.0 if stack=='double' else 0
    h=d+(n-1)*pitch+8; w=L+off+4
    out=box(x,y_top,w,h+6,c=1.5,fill=FILL,stroke=OUT,sw=1.2)
    items=[]
    for i in range(n):
        yc=y_top+4+d/2+i*pitch
        items.append((i,cartridge(kind,x+2+(off if i%2 else 0),yc)))
    out+=''.join(s for i,s in items if i%2)+''.join(s for i,s in items if not i%2)   # far column first
    yb=y_top+4+d+(n-1)*pitch
    out+=box(x+3,yb+1,w-6,3,fill=FILL,stroke=DIM,sw=1)                              # follower
    zz=[(x+4,yb+4)]+[(x+4+(w-8)*(0.1 if k%2==0 else .9),yb+4+k*1.5) for k in range(1,5)]
    out+=line(zz,stroke=DIM,sw=1)                                                    # spring
    return out,(w,h+6)
def curved_mag(kind,n,x,y_top,R=190,stack='double'):
    d=rd(kind); L=oal(kind); pitch=d*.5
    pts=[]; out=''
    items=[]
    for i in range(n):
        s_=4+d/2+i*pitch; th=s_/R
        cx=x+R*(1-math.cos(th)); cy=y_top+R*math.sin(th)
        rot=-math.degrees(th)
        items.append((i,cartridge(kind,cx-L*.35+(3 if i%2 else 0),cy,rot)))
        pts.append((cx,cy))
    th_end=(4+d+(n-1)*pitch+6)/R
    # outline of the curved box: walk the arc on both sides
    nseg=14; rear=[];front=[]
    for k in range(nseg+1):
        t=th_end*k/nseg
        cx=x+R*(1-math.cos(t)); cy=y_top+R*math.sin(t)
        nx,ny=math.cos(t),-math.sin(t)  # nose direction
        rear.append((cx-nx*(L*.35+4),cy-ny*(L*.35+4))); front.append((cx+nx*(L*.65+4),cy+ny*(L*.65+4)))
    outl=poly(rear+list(reversed(front)),fill=FILL,stroke=OUT,sw=1.2)
    body=''.join(s for i,s in items if i%2)+''.join(s for i,s in items if not i%2)
    h=R*math.sin(th_end)
    return outl+body,(L+10+R*(1-math.cos(th_end)),h)
