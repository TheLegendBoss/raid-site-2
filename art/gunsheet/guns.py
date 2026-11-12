from anatomy import *

def check_grip(g,kind,label):
    w=g.bx-g.ax
    need=oal(kind)+6
    assert w>=need-0.01, f'{label}: grip {w:.0f} mm wide, {kind} needs {need:.0f}'

def sights(front_x,rear_x,top,fh=8,rh=8):
    return (poly([(front_x,top),(front_x+6,top),(front_x+6,top-fh),(front_x,top-fh)])+
            poly([(rear_x,top),(rear_x+12,top),(rear_x+12,top-rh),(rear_x+8,top-rh),(rear_x+8,top-rh+3),(rear_x+4,top-rh+3),(rear_x+4,top-rh),(rear_x,top-rh)]))

# ------------------------------------------------------------ PISTOL
def pistol():
    g=Grip(4,13,42,24,96,18); check_grip(g,'9mm','pistol')
    o=''
    gt,_=guard_and_trigger(g,24)
    o+=gt+g.draw()
    o+=poly([(8,13),(8,24),(132,24),(132,13)])                         # dust cover
    o+=box(0,-19,170,32,c=3)+box(170,-5,7,10)                          # slide + barrel tip
    o+=''.join(line([(10+i*4,-16),(10+i*4,10)],stroke=DIM,sw=1) for i in range(5))
    o+=sights(160,4,-19)
    o+=port(66,-17,34,14)
    o+=cartridge('9mm',104,-32,-35,spent=True)                                    # case in flight, 1:1
    o+=poly(list(g.inner()),fill='none',stroke=DIM,sw=1) .replace('/>',' stroke-dasharray="3 3"/>')
    mag,(mw,mh)=box_mag('9mm',10,0,0)
    return dict(svg=o,bbox=(-34,-42,180,112),mag=(mag,mw,mh),name='PISTOL',sub='SIDEARM  ·  9 mm  ·  10 RDS',length=177,
                labels=[(66,-24,'port'),(112,50,'guard')])

# ------------------------------------------------------------ AUTOPISTOL
def autopistol():
    g=Grip(4,13,42,24,92,18); check_grip(g,'9mm','autopistol')
    o=''
    gt,_=guard_and_trigger(g,24)
    # extended magazine below the grip
    dx,dy=g.dx,g.dy; ext=48
    a=(g.a2[0]+3,g.a2[1]); b=(g.b2[0]-3,g.b2[1])
    o+=poly([a,b,(b[0]+dx*ext,b[1]+dy*ext),(a[0]+dx*ext,a[1]+dy*ext)])
    o+=gt+g.draw()
    o+=poly([(8,13),(8,24),(168,24),(168,13)])                         # long dust cover
    o+=box(146,24,16,40,c=3)                                          # folded foregrip
    o+=box(0,-19,190,32,c=3)+box(190,-15,22,28,c=2)                    # slide + compensator
    o+=''.join(box(194+i*6,-12,3,22,fill='#000',stroke=DIM,sw=1) for i in range(3))
    o+=''.join(line([(10+i*4,-16),(10+i*4,10)],stroke=DIM,sw=1) for i in range(5))
    o+=sights(178,4,-19)
    o+=port(70,-17,34,14)+cartridge('9mm',108,-32,-35,spent=True)
    o+=box(14,-6,10,5,c=1,fill='none',stroke=DIM,sw=1)                  # selector
    o+=poly(list(g.inner()),fill='none',stroke=DIM,sw=1).replace('/>',' stroke-dasharray="3 3"/>')
    mag,(mw,mh)=box_mag('9mm',20,0,0)
    return dict(svg=o,bbox=(-34,-42,214,125),mag=(mag,mw,mh),name='AUTOPISTOL',sub='MACHINE PISTOL  ·  9 mm  ·  20 RDS',length=212,
                labels=[(70,-24,'port'),(162,66,'foregrip')])

# ------------------------------------------------------------ MAGNUM
def magnum():
    g=Grip(6,20,60,34,112,14); check_grip(g,'mag','magnum')
    o=''
    gt,_=guard_and_trigger(g,34,depth=40,trig_gap=27,front_gap=38,t=6)
    o+=gt+g.draw()
    o+=poly([(14,20),(14,34),(246,34),(246,20)])+line([(150,27),(236,27)],stroke=DIM,sw=1)   # long dust cover with rail slots
    o+=box(0,-24,238,46,c=5)                                            # slab slide
    o+=box(18,-31,196,7,c=1)                                            # raised top rib
    o+=poly([(238,-18),(284,-18),(284,22),(238,22)])+poly([(238,-18),(284,-18),(278,-26),(244,-26)]) # shroud with step
    o+=vents(248,-8,5,24,4,9)+box(284,-12,10,28,c=2)                      # vents + muzzle ring
    o+=''.join(line([(10+i*4,-20),(10+i*4,18)],stroke=DIM,sw=1) for i in range(5))
    o+=sights(226,4,-31,fh=9,rh=9)
    o+=port(96,-22,50,22)+cartridge('mag',112,-42,-35,spent=True)
    o+=poly(list(g.inner(inset=3.5)),fill='none',stroke=DIM,sw=1).replace('/>',' stroke-dasharray="3 3"/>')
    mag,(mw,mh)=box_mag('mag',7,0,0,stack='single')
    return dict(svg=o,bbox=(-34,-56,296,148),mag=(mag,mw,mh),name='MAGNUM',sub='HEAVY SIDEARM  ·  .50 CLASS  ·  7 RDS',length=294,
                labels=[(96,-34,'port'),(150,48,'long dust cover')])

# ------------------------------------------------------------ SMG
def smg():
    g=Grip(40,22,86,22,92,12); check_grip(g,'9mm','smg')
    o=''
    # wire stock, extended
    o+=line([(0,-14),(-182,-14),(-196,-2),(-196,26),(-182,38),(-70,38),(0,12)])
    o+=box(-202,-6,10,40,c=2)+line([(-182,-14),(-182,38)],stroke=DIM,sw=1)
    gt,_=guard_and_trigger(g,22)
    # magazine through the grip, long stick
    dx,dy=g.dx,g.dy; ext=88
    a=(g.a2[0]+3,g.a2[1]); b=(g.b2[0]-3,g.b2[1])
    o+=poly([a,b,(b[0]+dx*ext,b[1]+dy*ext),(a[0]+dx*ext,a[1]+dy*ext)])
    o+=gt+g.draw()
    o+=box(0,-24,266,46,c=4)                                            # receiver
    o+=box(266,-18,118,36,c=3)+vents(280,-6,9,12,5,20)+box(384,-6,14,12)  # shroud + muzzle
    o+=box(300,18,24,52,c=3)                                            # foregrip
    o+=box(190,-30,20,6,c=1)                                            # charging handle
    o+=sights(360,24,-24,fh=10,rh=8)
    o+=port(150,-21,34,14)+cartridge('9mm',156,-38,-35,spent=True)
    o+=poly(list(g.inner()),fill='none',stroke=DIM,sw=1).replace('/>',' stroke-dasharray="3 3"/>')
    mag,(mw,mh)=box_mag('9mm',30,0,0)
    return dict(svg=o,bbox=(-210,-46,400,190),mag=(mag,mw,mh),name='SMG',sub='COMPACT AUTOGUN  ·  9 mm  ·  30 RDS',length=598,
                labels=[(150,-42,'port'),(330,66,'foregrip')])

# ------------------------------------------------------------ SHOTGUN (stockless pump, x-ray tube)
def shotgun():
    g=Grip(4,34,44,34,100,18)
    o=''
    gt,_=guard_and_trigger(g,34)
    o+=gt+g.draw()
    o+=box(150,-13,500,26,c=2)                                          # barrel
    o+=box(150,15,490,24,c=3)                                           # tube (shells x-rayed)
    o+=''.join(shell12(172+70*k,27) for k in range(6))
    o+=line([(594+i*6,27+(5 if i%2 else -5)) for i in range(8)],stroke=DIM,sw=1)   # spring + follower
    o+=box(590,19,3,16,c=0.5,stroke=DIM)
    o+=box(0,-22,150,56,c=4)                                            # receiver
    o+=box(205,6,150,42,c=6,fill='none')                                # pump forend (x-ray)
    o+=''.join(line([(216+i*9,12),(216+i*9,42)],stroke=DIM,sw=1) for i in range(14))
    o+=poly([(646,-13),(654,-13),(654,-20),(646,-20)])
    o+=port(34,-18,78,26)+shell12(60,-48,-30)
    o+=box(60,31,80,5,c=1,fill='none',stroke=AMB)                       # loading port
    return dict(svg=o,bbox=(-34,-70,656,142),mag=None,name='SCATTER GUN',sub='PUMP SHOTGUN  ·  12 GAUGE  ·  6 SHELLS',length=654,
                labels=[(60,-52,'port'),(330,66,'forend'),(300,-20,'tube holds 6 shells')])

# ------------------------------------------------------------ ASSAULT RIFLE
def assault():
    g=Grip(10,32,50,32,88,24)
    o=''
    # stock
    o+=poly([(-8,-14),(-205,-8),(-224,-8),(-224,38),(-205,30),(-8,16)])
    gt,(tx,gf,gb)=guard_and_trigger(g,32)
    mag,(mw,mh)=curved_mag('556',30,gf+8+4+20,32,R=260)
    o+=mag
    o+=gt+g.draw()
    o+=box(0,4,205,28,c=3)                                              # lower receiver
    o+=box(0,-26,236,30,c=3)                                            # upper receiver
    o+=box(10,-33,222,7,c=1)+''.join(line([(14+i*9,-33),(14+i*9,-27)],stroke=DIM,sw=1) for i in range(24))
    o+=box(236,-22,232,40,c=4)+vents(250,-12,26,8,7,31)+vents(250,4,26,8,7,31)
    o+=box(468,-6,152,12,c=1)+box(620,-9,34,18,c=2)+vents(626,-9,3,18,4,7)
    o+=poly([(540,-6),(546,-44),(554,-44),(560,-6)])
    o+=poly([(14,-33),(14,-46),(34,-46),(34,-33)])
    o+=port(120,-22,66,18)+cartridge('556',126,-40,-35,spent=True)
    o+=line([(196,-14),(212,-14)],stroke=DIM,sw=1)
    return dict(svg=o,bbox=(-230,-60,660,180),mag=(mag_inset('556',30,260),mw,mh),name='ASSAULT RIFLE',sub='SERVICE AUTOGUN  ·  5.56 CLASS  ·  30 RDS',length=878,
                labels=[(120,-44,'port')])

def mag_inset(kind,n,R):
    s,_=curved_mag(kind,n,CAL[kind]['oal']*.35+4,0,R=R)
    return s

# ------------------------------------------------------------ RIFLE (marksman)
def rifle():
    g=Grip(12,34,56,34,92,22)
    o=''
    o+=poly([(-8,-20),(-120,-22),(-236,-16),(-250,-14),(-250,44),(-236,46),(-150,26),(-8,16)])
    gt,(tx,gf,gb)=guard_and_trigger(g,34)
    mag,(mw,mh)=box_mag('762',8,gf+12,34)
    o+=mag
    o+=gt+g.draw()
    o+=box(0,4,215,30,c=3)+box(0,-28,262,32,c=3)                         # receiver
    o+=box(262,-21,300,36,c=4)+vents(280,-10,34,7,7,36)                  # handguard
    o+=box(562,-7,262,14,c=1)+box(824,-11,36,22,c=2)+vents(830,-11,3,22,4,8)
    o+=box(30,-74,236,26,c=6)+poly([(266,-70),(300,-78),(300,-44),(266,-52)])   # scope tube + bell
    o+=box(14,-72,22,22,c=3)+box(70,-50,12,24)+box(200,-50,12,24)
    o+=port(100,-26,80,20)+cartridge('762',108,-46,-35,spent=True)
    return dict(svg=o,bbox=(-256,-86,862,150),mag=(mag_s(box_mag('762',8,0,0)),mw,mh),name='RIFLE',sub='MARKSMAN RIFLE  ·  7.62 CLASS  ·  8 RDS',length=1110,
                labels=[(100,-52,'port')])
def mag_s(t): return t[0]

GUNS=[shotgun,assault,rifle,pistol,magnum,autopistol,smg]
