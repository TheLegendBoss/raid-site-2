// The clone, seen from above, facing +x (right). Every part is a 64x64 canvas centred on (32,32)
// so the game can stack them at the same origin and animate by offsetting. Lighting is
// radial/symmetric on purpose: the sprite rotates with the aim, so a baked top-left light would spin.
pal({
  k: "#03080a", rim: "#6dff8a",
  a0: "#0b1716", a1: "#143028", a2: "#22524a", a3: "#37806f", a4: "#74d6b4",
  gr: "#6dff8a", gd: "#2cae58",
  m0: "#12181b", m1: "#252e33", m2: "#40505a", m3: "#7690a0",
  au: "#ffd36b", ao: "#ff9a3c",
})
ramps("a0 a1 a2 a3 a4")

const C = 32

// ---------- body: backpack, torso, pauldrons ----------
const pauldron = (s) => {
  const y = C + s * 16
  return [
    // outer plate
    rect(23, y - 6, 19, 12, { r: 5, fill: rad(["a3", "a2", "a1"], { cx: 0.5, cy: 0.5, r: 0.75 }), stroke: "k", sw: 1.4 }),
    // raised rim and trim stripe
    rect(25, y - 4, 15, 8, { r: 3.5, fill: "none", stroke: "a4", sw: 0.8, opacity: 0.7 }),
    rect(27, y - 1.1, 11, 2.2, { r: 1, fill: "gr", glow: { r: 3, color: "gr", strength: 1 } }),
    circle(40, y, 1.3, { fill: "m3", stroke: "k", sw: 0.6 }),
    circle(25, y, 1.1, { fill: "m3", stroke: "k", sw: 0.6 }),
  ]
}

sprite("clone_body", { w: 64, h: 64 },
  // power pack behind the shoulders
  rect(11, 23, 14, 18, { r: 3.5, fill: lin(["m2", "m0"], 0), stroke: "k", sw: 1.4 }),
  rect(13, 26, 8, 2, { r: 1, fill: "k" }),
  rect(13, 30.5, 8, 2, { r: 1, fill: "k" }),
  rect(13, 35, 8, 2, { r: 1, fill: "k" }),
  rect(10.5, 29, 2.6, 6, { r: 1, fill: "gr", glow: { r: 4, color: "gr", strength: 2 } }),
  // torso
  blob([20, 32, 23, 23, 32, 19.5, 40, 23, 43, 32, 40, 41, 32, 44.5, 23, 41],
    { fill: rad(["a3", "a2", "a0"], { cx: 0.55, cy: 0.5, r: 0.8 }), stroke: "k", sw: 1.4 }),
  // chest plate: centre keel and a bright aquila-ish chevron
  clip(blob([20, 32, 23, 23, 32, 19.5, 40, 23, 43, 32, 40, 41, 32, 44.5, 23, 41], "k"),
    rect(33, 24, 3, 16, { fill: "a4", opacity: 0.35 }),
    line([26, 27, 34, 32, 26, 37], { stroke: "a4", sw: 1.3, opacity: 0.8 }),
    ellipse(36, 32, 7, 11, { fill: "a4", opacity: 0.12 })),
  circle(38.5, 32, 1.6, { fill: "gr", glow: { r: 3, color: "gr", strength: 1.5 } }),
  pauldron(-1), pauldron(1))

// ---------- helmet ----------
sprite("clone_head", { w: 64, h: 64 },
  blob([24, 32, 26, 26, 32, 23, 38, 26, 41, 32, 38, 38, 32, 41, 26, 38],
    { fill: rad(["a3", "a2", "a0"], { cx: 0.6, cy: 0.5, r: 0.75 }), stroke: "k", sw: 1.4 }),
  // crest ridge front to back
  line([26, 32, 38, 32], { stroke: "a1", sw: 2.2, opacity: 0.8 }),
  line([26.5, 32, 37.5, 32], { stroke: "a4", sw: 0.8, opacity: 0.8 }),
  // visor: a slit that glows
  path("M 37.5 27 Q 41.5 32 37.5 37 L 36 36 Q 39 32 36 28 Z",
    { fill: "gr", stroke: "k", sw: 0.5, glow: { r: 2.5, color: "gr", strength: 1.2 } }),
  // rear vents
  line([25, 29, 25, 35], { stroke: "k", sw: 1.1, opacity: 0.7 }))

// ---------- arms and carbine ----------
sprite("clone_arms", { w: 64, h: 64 },
  // carbine, held right of centre (+y is the clone's right hand). Muzzle tip at x=63.
  rect(28, 34, 11, 5, { r: 1.5, fill: lin(["m1", "m0"], 90), stroke: "k", sw: 1 }),         // stock
  rect(37, 33, 13, 6.4, { r: 1.5, fill: lin(["m3", "m1"], 90), stroke: "k", sw: 1.2 }),      // receiver
  rect(49, 34.2, 9, 4, { r: 1, fill: lin(["m2", "m0"], 90), stroke: "k", sw: 1 }),            // handguard
  line([57, 36.2, 62, 36.2], { stroke: "m3", sw: 1.7 }),                                        // barrel
  rect(60, 34.5, 3.6, 3.4, { r: 0.8, fill: "m1", stroke: "k", sw: 0.8 }),                       // muzzle brake
  rect(39.5, 31.2, 8, 3.2, { r: 1, fill: "m2", stroke: "k", sw: 0.8 }),                         // optic body
  circle(47.6, 32.8, 1.3, { fill: "gr", glow: { r: 2.5, color: "gr", strength: 1.2 } }),        // optic lens
  rect(43.5, 38.2, 3, 1.4, { r: 0.5, fill: "au" }),                                             // ejection port
  line([38, 35, 50, 35], { stroke: "m3", sw: 0.6, opacity: 0.8 }),
  // right arm: shoulder to grip
  line([34, 47, 40, 44, 42.5, 38], { stroke: "k", sw: 6.4 }),
  line([34, 47, 40, 44, 42.5, 38], { stroke: "a2", sw: 4.8 }),
  line([34, 47, 40, 44, 42.5, 38], { stroke: "a3", sw: 1.3, opacity: 0.6 }),
  circle(42.8, 37.2, 3.1, { fill: "m1", stroke: "k", sw: 1 }),
  // left arm: shoulder out and across to the handguard
  line([36, 17, 47, 20, 53, 33], { stroke: "k", sw: 5.6 }),
  line([36, 17, 47, 20, 53, 33], { stroke: "a2", sw: 4 }),
  line([36, 17, 47, 20, 53, 33], { stroke: "a3", sw: 1.2, opacity: 0.6 }),
  circle(53.2, 35, 3, { fill: "m1", stroke: "k", sw: 1 }))

// ---------- boots ----------
sprite("clone_boot", { w: 16, h: 10 },
  rect(1.5, 1.5, 13, 7, { r: 3, fill: lin(["m2", "m0"], 0), stroke: "k", sw: 1.2 }),
  rect(9, 2.4, 4.4, 5.2, { r: 2, fill: "m3", opacity: 0.55 }),
  line([3.5, 5, 7, 5], { stroke: "a3", sw: 1, opacity: 0.7 }))

// A look-at sheet (not used by the game): everything assembled, on the game's dark ground.
scene("clone_assembled", { w: 96, h: 64, bg: "#05080a" },
  tf({ x: 16 }, stamp("clone_boot", 28, 25, { anchor: "center" }), stamp("clone_boot", 38, 39, { anchor: "center" }),
    stamp("clone_body", 32, 32, { anchor: "center" }), stamp("clone_arms", 32, 32, { anchor: "center" }),
    stamp("clone_head", 32, 32, { anchor: "center" })))
