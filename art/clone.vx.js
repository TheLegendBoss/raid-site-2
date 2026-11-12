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

// Both arms are held straight out along the aim, so the SMG and the blade point at the target.
// The SMG sits on y=43.5 (the clone's right, 11.5 off the aim line); the game fires bullets from
// its muzzle and aims them at the cursor. This canvas is 72 wide so the arm and gun can reach out:
// the game places it with origin x = 32/72 so the clone's centre stays at (32,32).
const SY = 43.5
const smg = () => [
  rect(48, SY - 2.2, 5, 4.4, { r: 1, fill: "m1", stroke: "k", sw: 0.9 }),                       // folded stock
  rect(52, SY - 2.5, 9, 5, { r: 1, fill: lin(["m3", "m1"], 90), stroke: "k", sw: 1 }),          // receiver
  rect(60, SY - 2, 6, 4, { r: 0.8, fill: lin(["m2", "m0"], 90), stroke: "k", sw: 0.9 }),        // shroud
  line([61.5, SY - 0.9, 64.5, SY - 0.9], { stroke: "k", sw: 0.6 }), line([61.5, SY + 0.9, 64.5, SY + 0.9], { stroke: "k", sw: 0.6 }),
  rect(65, SY - 1.5, 4.4, 3, { r: 0.6, fill: "m1", stroke: "k", sw: 0.8 }),                      // barrel
  rect(68.2, SY - 1.9, 2.4, 3.8, { r: 0.5, fill: "m2", stroke: "k", sw: 0.8 }),                  // muzzle brake
  rect(54, SY - 4.5, 5.5, 2, { r: 0.6, fill: "m2", stroke: "k", sw: 0.7 }),                      // sight rail
  circle(58.4, SY - 5.6, 0.9, { fill: "rd", glow: { r: 2, color: "rd", strength: 1.4 } }),        // red dot
  rect(56, SY + 2.3, 2.6, 1.2, { r: 0.4, fill: "au" }),                                           // ejection port
]

// Weapon shapes. Every weapon sits on y=SY, ends at x<=72, and the muzzle x is noted so the game's
// muzzleOffset (muzzle x minus 32) matches.
const pistol = () => [                                                                          // muzzle x=66.2
  rect(55, SY - 2.2, 7, 4.4, { r: 0.9, fill: lin(["m3", "m1"], 90), stroke: "k", sw: 0.9 }),     // slide
  rect(61.6, SY - 1.6, 3.6, 3.2, { r: 0.6, fill: "m1", stroke: "k", sw: 0.8 }),                  // barrel
  rect(64.4, SY - 1.9, 1.8, 3.8, { r: 0.4, fill: "m2", stroke: "k", sw: 0.7 }),                  // muzzle
  rect(56.5, SY - 3.7, 3, 1.4, { r: 0.4, fill: "m2", stroke: "k", sw: 0.6 }),                    // sight
  rect(57, SY + 2.2, 2.4, 1.1, { r: 0.4, fill: "au" }),                                           // ejection port
]

const magnum = () => [                                                                          // muzzle x=69.6
  rect(54, SY - 3, 8, 6, { r: 1.2, fill: lin(["m3", "m1"], 90), stroke: "k", sw: 1 }),           // frame
  circle(59.5, SY, 3.4, { fill: lin(["m2", "m0"], 90), stroke: "k", sw: 0.9 }),                  // cylinder
  circle(59.5, SY, 1.2, { fill: "k" }),
  rect(61, SY - 2.4, 8.6, 3.4, { r: 0.6, fill: "m1", stroke: "k", sw: 0.8 }),                    // heavy barrel
  rect(62, SY + 0.9, 6.4, 1.9, { r: 0.5, fill: "m2", stroke: "k", sw: 0.7 }),                    // underlug
  rect(68.4, SY - 2.8, 1.2, 4.2, { r: 0.4, fill: "m2", stroke: "k", sw: 0.7 }),                  // muzzle
  rect(52.2, SY - 4.2, 2.6, 2.2, { r: 0.5, fill: "m2", stroke: "k", sw: 0.6 }),                  // hammer
  rect(65, SY - 3.7, 2.6, 1.3, { r: 0.4, fill: "rd" }),                                           // front sight
]

const shotgun = () => [                                                                         // muzzle x=71.8
  rect(44, SY - 2.4, 8, 4.8, { r: 1, fill: "m1", stroke: "k", sw: 0.9 }),                        // stock
  rect(51, SY - 2.8, 10, 5.6, { r: 1, fill: lin(["m3", "m1"], 90), stroke: "k", sw: 1 }),        // receiver
  rect(60, SY - 2.5, 11.8, 2.3, { r: 0.6, fill: "m1", stroke: "k", sw: 0.8 }),                   // barrel
  rect(60, SY + 0.2, 9.4, 2.3, { r: 0.6, fill: "m2", stroke: "k", sw: 0.8 }),                    // magazine tube
  rect(61.5, SY - 3.7, 5.4, 7.4, { r: 1.2, fill: lin(["m2", "m0"], 90), stroke: "k", sw: 0.9 }), // pump
  line([63, SY - 2.6, 63, SY + 2.6], { stroke: "k", sw: 0.5 }), line([65, SY - 2.6, 65, SY + 2.6], { stroke: "k", sw: 0.5 }),
  rect(70.4, SY - 3, 1.6, 3.6, { r: 0.4, fill: "au", stroke: "k", sw: 0.6 }),                    // bead
]

const marksman = () => [                                                                        // muzzle x=71.9
  rect(45, SY - 2.2, 8, 4.4, { r: 1, fill: "m1", stroke: "k", sw: 0.9 }),                        // stock
  rect(52, SY - 2.5, 10, 5, { r: 1, fill: lin(["m3", "m1"], 90), stroke: "k", sw: 1 }),          // receiver
  rect(61.5, SY - 1.5, 10.4, 3, { r: 0.6, fill: "m1", stroke: "k", sw: 0.8 }),                   // long barrel
  rect(70, SY - 2.1, 1.9, 4.2, { r: 0.4, fill: "m2", stroke: "k", sw: 0.7 }),                    // muzzle brake
  rect(55, SY - 6.4, 8.6, 3, { r: 1.2, fill: lin(["m1", "m0"], 90), stroke: "k", sw: 0.9 }),     // scope
  circle(63.8, SY - 4.9, 1.2, { fill: "bl", glow: { r: 2.2, color: "bl", strength: 1.3 } }),     // lens
  rect(57.5, SY - 3.5, 1.6, 1.4, { fill: "m2", stroke: "k", sw: 0.5 }),                          // mount
  rect(59, SY + 2.2, 2.4, 1.1, { r: 0.4, fill: "au" }),                                           // ejection port
]

const burst = () => [                                                                           // muzzle x=71.8
  rect(48.5, SY - 2.2, 4.5, 4.4, { r: 1, fill: "m1", stroke: "k", sw: 0.9 }),                    // stock stub
  rect(52, SY - 2.6, 10, 5.2, { r: 1, fill: lin(["m3", "m1"], 90), stroke: "k", sw: 1 }),        // receiver
  rect(61, SY - 2.3, 6.8, 4.6, { r: 0.8, fill: lin(["m2", "m0"], 90), stroke: "k", sw: 0.9 }),   // handguard
  line([62.5, SY - 1.1, 66.3, SY - 1.1], { stroke: "k", sw: 0.55 }), line([62.5, SY + 1.1, 66.3, SY + 1.1], { stroke: "k", sw: 0.55 }),
  rect(67.4, SY - 1.5, 3, 3, { r: 0.5, fill: "m1", stroke: "k", sw: 0.8 }),                      // barrel
  rect(69.6, SY - 2.6, 2.2, 5.2, { r: 0.4, fill: "m2", stroke: "k", sw: 0.8 }),                  // flash hider
  rect(54, SY - 4.6, 6, 2, { r: 0.6, fill: "m2", stroke: "k", sw: 0.7 }),                        // sight rail
  circle(58, SY - 5.6, 0.9, { fill: "gr", glow: { r: 2, color: "gr", strength: 1.4 } }),         // green dot
  rect(56, SY + 2.3, 2.6, 1.2, { r: 0.4, fill: "au" }),                                           // ejection port
]

// Arms hold one weapon on the right and the blade hand on the left. Same arm blocks for every weapon.
const arms = (name, weapon) => sprite(name, { w: 72, h: 64 },
  // right arm: one straight block out of the pauldron to the grip
  seg([41, SY, 54, SY], 6.4),
  plate(46, SY - 3.9, 5.5, 7.8, 1.5, "a3", { sw: 0.8 }),                                          // vambrace
  weapon(),
  rect(52, SY - 3.2, 6.4, 6.4, { r: 1.5, fill: "m1", stroke: "k", sw: 1 }),                      // gauntlet on the grip
  // left arm: one straight block out to the sword hand
  seg([41, 15.5, 52, 15.5], 6.4),
  plate(44.5, 11.6, 5, 7.8, 1.5, "a3", { sw: 0.8 }),
  rect(49.2, 12.3, 6.4, 6.4, { r: 1.5, fill: "m1", stroke: "k", sw: 1 }))                         // gauntlet on the hilt

arms("clone_arms", smg)
arms("clone_arms_pistol", pistol)
arms("clone_arms_magnum", magnum)
arms("clone_arms_shotgun", shotgun)
arms("clone_arms_marksman", marksman)
arms("clone_arms_burst", burst)

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

// Great cleaver: short, broad, heavy. Same pivot and orientation as the arc blade.
sprite("clone_cleaver", { w: 64, h: 64 },
  rect(23, 30, 9, 4, { r: 1, fill: "m1", stroke: "k", sw: 0.9 }),
  rect(21.2, 29, 2.8, 6, { r: 0.8, fill: "au", stroke: "k", sw: 0.7 }),
  rect(31.6, 26.5, 3.4, 11, { r: 0.8, fill: "m2", stroke: "k", sw: 0.9 }),
  poly([35, 27.2, 55, 26.4, 61, 28.5, 61, 35.5, 55, 37.6, 35, 36.8],
    { fill: lin(["bw", "bl"], 90), stroke: "bl", sw: 0.9, glow: { r: 3.2, color: "bl", strength: 1.8 } }),
  line([37, 32, 58, 32], { stroke: "bw", sw: 1, opacity: 0.9 }),
  rect(44, 29.4, 2.2, 5.2, { r: 0.6, fill: "k", opacity: 0.45 }))

// Stiletto: long, thin, fast.
sprite("clone_stiletto", { w: 64, h: 64 },
  rect(24, 30.6, 8, 2.8, { r: 0.8, fill: "m1", stroke: "k", sw: 0.8 }),
  rect(22.4, 29.8, 2.2, 4.4, { r: 0.6, fill: "au", stroke: "k", sw: 0.6 }),
  rect(31.8, 28.8, 2.4, 6.4, { r: 0.6, fill: "m2", stroke: "k", sw: 0.8 }),
  poly([34, 31.1, 61, 31.5, 63.6, 32, 61, 32.5, 34, 32.9],
    { fill: lin(["bw", "bl"], 90), stroke: "bl", sw: 0.7, glow: { r: 2.6, color: "bl", strength: 1.5 } }),
  line([35, 32, 62, 32], { stroke: "bw", sw: 0.6, opacity: 0.9 }))

// ---------- boots ----------
sprite("clone_boot", { w: 18, h: 11 },
  poly(cr(1.5, 1.5, 15, 8, 2.6), { fill: lin(["m2", "m0"], 0), stroke: "k", sw: 1.2 }),
  poly(cr(9.8, 2.5, 5.8, 6, 1.6), { fill: "m3", opacity: 0.5 }),
  line([3.5, 4.2, 7.5, 4.2], { stroke: "a3", sw: 0.8, opacity: 0.8 }),
  line([3.5, 6.6, 7.5, 6.6], { stroke: "a3", sw: 0.8, opacity: 0.8 }))

// A look-at sheet (not used by the game): the rest pose assembled on the game's dark ground.
scene("clone_assembled", { w: 112, h: 64, bg: "#05080a" },
  tf({ x: 16 },
    stamp("clone_boot", 28, 22, { anchor: "center" }), stamp("clone_boot", 38, 42, { anchor: "center" }),
    stamp("clone_body", 32, 32, { anchor: "center" }),
    tf({ rot: -12, origin: [52.2, 15.5] }, stamp("clone_sword", 52.2, 15.5, { anchor: "center" })),
    stamp("clone_arms", 36, 32, { anchor: "center" }),
    stamp("clone_head", 32, 32, { anchor: "center" })))
