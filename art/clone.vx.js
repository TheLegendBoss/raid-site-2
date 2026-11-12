// The clone, seen from above, facing +x (right). Heavy, blocky plate: chamfered slabs, no curves
// where armour would be cast. One-handed SMG in the right hand (+y), arc blade in the left (-y).
// Every part is a 64x64 canvas centred on (32,32) so the game stacks them at one origin and
// animates by offsets. Lighting is radial/symmetric on purpose: the sprite rotates with the aim.
pal({
  k: "#03080a",
  a0: "#0b1716", a1: "#143028", a2: "#22524a", a3: "#37806f", a4: "#74d6b4",
  m0: "#12181b", m1: "#252e33", m2: "#40505a", m3: "#7690a0",
  gr: "#6dff8a", au: "#ffb347", rd: "#ff4d4d",
  bl: "#7fe8ff", bw: "#eafcff",
})

// Chamfered rectangle: corners cut at 45 degrees. Returns poly points.
const cr = (x, y, w, h, c) => [
  x + c, y, x + w - c, y, x + w, y + c, x + w, y + h - c,
  x + w - c, y + h, x + c, y + h, x, y + h - c, x, y + c,
]
const plate = (x, y, w, h, c, fill, extra = {}) => poly(cr(x, y, w, h, c), { fill, stroke: "k", sw: 1.3, ...extra })
const edge = (x, y, w, h, c, col = "a4", o = 0.55) => poly(cr(x, y, w, h, c), { fill: "none", stroke: col, sw: 0.7, opacity: o })
const rivet = (x, y) => circle(x, y, 0.95, { fill: "m3", stroke: "k", sw: 0.5 })

// ---------- body: pack, torso, pauldrons ----------
const pauldron = (s) => {
  const cy = 32 + s * 17
  return [
    plate(21.5, cy - 8, 23, 16, 4.5, rad(["a3", "a2", "a1"], { cx: 0.5, cy: 0.5, r: 0.8 })),
    plate(25, cy - 5.2, 14, 10.4, 3, rad(["a4", "a3", "a2"], { cx: 0.5, cy: 0.5, r: 0.9 }), { sw: 0.8 }),
    edge(23.5, cy - 6.5, 19, 13, 3.5),
    rect(40.2, cy - 6, 2.4, 12, { r: 0.6, fill: "au", stroke: "k", sw: 0.6 }),   // forward trim, amber
    s < 0
      ? [rect(27.5, cy - 2.2, 8, 1.4, { fill: "k", opacity: 0.55 }), rect(27.5, cy + 0.8, 8, 1.4, { fill: "k", opacity: 0.55 })]
      : [rect(27.5, cy - 2.8, 1.4, 5.6, { fill: "k", opacity: 0.55 }), rect(30.5, cy - 2.8, 1.4, 5.6, { fill: "k", opacity: 0.55 }), rect(33.5, cy - 2.8, 1.4, 5.6, { fill: "k", opacity: 0.55 })],
    rivet(23.8, cy - 5.6), rivet(23.8, cy + 5.6), rivet(38.4, cy - 5.6), rivet(38.4, cy + 5.6),
  ]
}

sprite("clone_body", { w: 64, h: 64 },
  // power pack: boxy, ribbed, twin exhausts
  plate(6.5, 21, 16, 22, 3.5, lin(["m2", "m0"], 0)),
  rect(9, 25, 9, 1.6, { fill: "k" }), rect(9, 29.7, 9, 1.6, { fill: "k" }), rect(9, 34.4, 9, 1.6, { fill: "k" }),
  rect(5.5, 28.5, 3, 7, { r: 1, fill: "gr", glow: { r: 4, color: "gr", strength: 2 } }),
  circle(12, 22, 1.7, { fill: "m0", stroke: "m3", sw: 0.6 }), circle(12, 42, 1.7, { fill: "m0", stroke: "m3", sw: 0.6 }),
  rect(20, 26.5, 4, 11, { fill: "m1", stroke: "k", sw: 1 }),
  // torso: slab with a raised chest block and a core light
  plate(19.5, 20.5, 25.5, 23, 5.5, rad(["a3", "a2", "a0"], { cx: 0.55, cy: 0.5, r: 0.85 })),
  plate(27, 24.5, 14, 15, 3.5, rad(["a4", "a3", "a1"], { cx: 0.5, cy: 0.5, r: 0.8 }), { sw: 0.9 }),
  edge(25.5, 23, 17, 18, 4),
  line([27, 32, 41, 32], { stroke: "k", sw: 0.8, opacity: 0.5 }),
  rect(34.4, 29.4, 5, 5.2, { r: 1.2, fill: "m1", stroke: "k", sw: 0.7 }),
  circle(36.9, 32, 1.5, { fill: "gr", glow: { r: 3, color: "gr", strength: 1.6 } }),
  rivet(29, 26.5), rivet(29, 37.5), rivet(39.5, 26.5), rivet(39.5, 37.5),
  pauldron(-1), pauldron(1))

// ---------- helmet: a blocky bucket with one wide visor ----------
sprite("clone_head", { w: 64, h: 64 },
  plate(24.5, 24, 17, 16, 5, rad(["a3", "a2", "a0"], { cx: 0.6, cy: 0.5, r: 0.8 })),
  edge(26, 25.5, 14, 13, 4, "a4", 0.5),
  rect(27, 29, 8, 6, { r: 1.5, fill: "a1", stroke: "k", sw: 0.6, opacity: 0.8 }),             // crown plate
  rect(37, 27.4, 4.4, 9.2, { r: 1.3, fill: "m0", stroke: "k", sw: 0.8 }),                     // visor housing
  rect(37.9, 28.4, 3.2, 7.2, { r: 1, fill: "gr", glow: { r: 2.6, color: "gr", strength: 1.3 } }),
  line([27.5, 26.2, 27.5, 28], { stroke: "k", sw: 0.9, opacity: 0.7 }), line([27.5, 36, 27.5, 37.8], { stroke: "k", sw: 0.9, opacity: 0.7 }),
  rect(24, 30, 2.6, 4, { fill: "m1", stroke: "k", sw: 0.7 }))                                 // rear cable port

// ---------- arms and one-handed SMG ----------
// Armour blocks along a segment: butt-capped so they read as plates, not tubes.
const seg = (pts, w, hi = true) => [
  line(pts, { stroke: "k", sw: w + 1.6, cap: "butt", join: "miter" }),
  line(pts, { stroke: "a2", sw: w, cap: "butt", join: "miter" }),
  hi ? line(pts, { stroke: "a3", sw: w * 0.35, cap: "butt", join: "miter", opacity: 0.7 }) : null,
]

// The SMG is drawn level along y=39 from the grip at x=44, then angled in so the muzzle sits on the
// aim line (x=63, y~32.5): that is where the game spawns bullets.
const smg = () => tf({ rot: -19, origin: [44, 39] },
  rect(44, 37, 9, 4.6, { r: 1, fill: lin(["m3", "m1"], 90), stroke: "k", sw: 1 }),             // receiver
  rect(52, 37.4, 6, 3.8, { r: 0.8, fill: lin(["m2", "m0"], 90), stroke: "k", sw: 0.9 }),       // shroud
  line([53.5, 38.4, 56.5, 38.4], { stroke: "k", sw: 0.7 }), line([53.5, 40.2, 56.5, 40.2], { stroke: "k", sw: 0.7 }),
  rect(57.5, 38, 4.6, 3, { r: 0.6, fill: "m1", stroke: "k", sw: 0.8 }),                         // barrel + brake
  rect(61.2, 37.6, 2.2, 3.8, { r: 0.5, fill: "m2", stroke: "k", sw: 0.8 }),
  rect(40, 37.4, 5, 3.8, { r: 1, fill: "m1", stroke: "k", sw: 0.9 }),                           // folded stock block
  rect(46, 35.6, 5.5, 2.2, { r: 0.6, fill: "m2", stroke: "k", sw: 0.7 }),                        // sight rail
  circle(50.4, 36.7, 0.9, { fill: "rd", glow: { r: 2, color: "rd", strength: 1.4 } }),           // red dot
  rect(47.5, 40.6, 2.6, 1.2, { r: 0.4, fill: "au" }))                                           // ejection port

sprite("clone_arms", { w: 64, h: 64 },
  // right arm to the gun: upper arm out of the pauldron, forearm bent in to the grip
  seg([42, 49, 47, 47], 6.4), seg([47, 47, 49, 42.5], 5.6),
  plate(45.4, 43.8, 4.2, 5.6, 1.3, "a3", { sw: 0.8 }),                                       // vambrace cap
  smg(),
  rect(46.6, 40, 5.6, 5, { r: 1.5, fill: "m1", stroke: "k", sw: 1 }),                        // gauntlet on the grip
  // left arm, bent, holding the sword low at the side
  seg([42, 15, 46, 13], 6.4), seg([46, 13, 47.5, 15.5], 5.6),
  plate(43.6, 11.6, 4.4, 5.2, 1.3, "a3", { sw: 0.8 }),
  rect(45.4, 12.2, 5.6, 5, { r: 1.5, fill: "m1", stroke: "k", sw: 1 }))                      // gauntlet on the hilt

// ---------- arc blade ----------
// Pivot (the hand) is the canvas centre (32,32); the blade points +x. The game rotates this part
// about the hand: low and out at rest, following the swing arc while the blade is out.
sprite("clone_sword", { w: 64, h: 64 },
  rect(23, 30.2, 9, 3.6, { r: 1, fill: "m1", stroke: "k", sw: 0.9 }),                         // grip
  rect(21.4, 29.4, 2.6, 5.2, { r: 0.8, fill: "au", stroke: "k", sw: 0.7 }),                   // pommel
  rect(31.6, 27.6, 3.2, 8.8, { r: 0.8, fill: "m2", stroke: "k", sw: 0.9 }),                   // guard
  poly([34.8, 30.4, 58, 30.7, 62.6, 32, 58, 33.3, 34.8, 33.6],
    { fill: lin(["bw", "bl"], 90), stroke: "bl", sw: 0.8, glow: { r: 3, color: "bl", strength: 1.6 } }),
  line([36, 32, 59, 32], { stroke: "bw", sw: 0.8, opacity: 0.9 }))

// ---------- boots ----------
sprite("clone_boot", { w: 18, h: 11 },
  poly(cr(1.5, 1.5, 15, 8, 2.6), { fill: lin(["m2", "m0"], 0), stroke: "k", sw: 1.2 }),
  poly(cr(9.8, 2.5, 5.8, 6, 1.6), { fill: "m3", opacity: 0.5 }),
  line([3.5, 4.2, 7.5, 4.2], { stroke: "a3", sw: 0.8, opacity: 0.8 }),
  line([3.5, 6.6, 7.5, 6.6], { stroke: "a3", sw: 0.8, opacity: 0.8 }))

// A look-at sheet (not used by the game): the rest pose assembled on the game's dark ground.
scene("clone_assembled", { w: 96, h: 64, bg: "#05080a" },
  tf({ x: 16 },
    stamp("clone_boot", 28, 22, { anchor: "center" }), stamp("clone_boot", 38, 42, { anchor: "center" }),
    stamp("clone_body", 32, 32, { anchor: "center" }),
    tf({ x: 15, y: -20, rot: -40, origin: [32, 32] }, stamp("clone_sword", 32, 32, { anchor: "center" })),
    stamp("clone_arms", 32, 32, { anchor: "center" }),
    stamp("clone_head", 32, 32, { anchor: "center" })))
