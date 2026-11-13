// Every tunable number lives here. Logic never hard-codes a value.
// Units: pixels, seconds, degrees where noted.

export const TUNING = {
  world: { w: 2000, h: 1300, wall: 40 },

  camera: {
    zoom: 1,
    followLerp: 9, // higher = snappier
    lookAhead: 0.2, // fraction of player->cursor vector the camera leans toward
    traumaDecay: 1.7,
    shakeMaxOffset: 14,
    kickDecay: 14,
    zoomPunchDecay: 7,
  },

  player: {
    radius: 14,
    maxSpeed: 235,
    accel: 2300,
    friction: 2600,
    maxHp: 100,
    maxShield: 100,
    shieldRegenDelay: 3,
    shieldRegenRate: 28,
    stepDistance: 52, // px travelled between footstep sounds
    dashSpeed: 720,
    dashTime: 0.15,
    dashCooldown: 0.9,
    swingMoveFactor: 0.35, // movement control while the blade is out
  },

  art: {
    scale: 0.25, // sprites are exported at 4x; draw them at game pixels
    stridePerPx: 0.11, // boot phase advanced per px travelled
    strideAmp: 8,
    bootY: 8,
    recoil: 3.4, // px the SMG and helmet snap back per shot
    recoilRecover: 34,
    dashStretch: 1.12,
    armsOriginX: 32 / 72, // the arms canvas is 72 wide so the arm and gun can reach out
    handX: 20.2, // left fist, in px from the clone's centre (art/clone.vx.js)
    handY: -16.5,
    swordRestRot: -0.21, // radians: blade held forward, angled slightly out, pointing at the enemy
  },

  /** Pixel UI (Waste No Space panels, Poco font, Mystery Attic icons, KabGames crosshair). `px` is the screen pixels per art pixel; `fontSizes` are the sizes Poco stays crisp at. */
  ui: {
    panelAlpha: 0.94,
    px: 3,
    iconPx: 2,
    fontSizes: [8, 12, 16, 24, 32, 48, 64, 96],
    crossPx: 2, // the centre dot
    // The reticle: a ring sized by the spread cone at the cursor's distance, four ticks outside it, and
    // the active reload drawn on the ring itself.
    reticle: { ringMin: 8, ringMax: 80, ringReload: 22, ringW: 2, tickGap: 3, tickLen: 6, arcW: 5 },
  },
  /** The pixel weapon in the HUD panel: sprite scale, offset from the panel's gun origin, recoil px per bolt px, rearward px per px dropped for raked magazines (1 / MAG_RAKE_ROWS in art/pixparts/parts.py). */
  pixGun: { scale: 3, x: 4, y: -42, kick: 0.5, magRake: 0.25 },
  gun: {
    name: 'SMG',
    fireDelay: 0.085,
    spread: 2.2, // degrees
    bulletSpeed: 1050,
    bulletLife: 0.9,
    damage: 11,
    damageVariance: 0.15, // +/- fraction, rolled per shot
    magSize: 30,
    startReserve: 120,
    maxReserve: 180,
    reserveRegenPerSec: 1.5, // generous for the feel test so you are never stranded
    reloadTime: 1.15, // tactical reload: rounds left in the mag
    reloadTimeEmpty: 1.6, // empty reload: bolt has to be racked
    magInAt: 0.7, // fraction of the reload at which the new mag seats
    // Active reload: press R again while the marker is inside the window to finish at once and
    // load the magazine hot. Press outside it and the weapon fumbles (once per reload).
    // Gears-style: a small white PERFECT zone sits inside a wider grey ACTIVE zone. Perfect loads the
    // magazine at once and hot; active loads it at once; a miss jams the action and sets the reload back.
    activeReload: {
      start: 0.5, // centre of the zones, as a fraction of the reload
      width: 0.08, // perfect zone width; the activeWidth stat scales it
      maxWidth: 0.2,
      goodPad: 0.09, // the active zone extends this far either side of the perfect zone
      bonusDamage: 0.25, // extra damage for the whole magazine after a perfect reload
      fumbleSetback: 0.4, // fraction of the reload lost on a mistimed press
      feedbackSeconds: 1.1, // how long the HUD result stays up
    },
    recoilImpulse: 38,
    cameraKick: 3.2, // px opposite the aim per shot
    shotTrauma: 0.045,
    muzzleOffset: 38.5, // forward of the clone's centre; matches the SMG muzzle in art/clone.vx.js
    muzzleSide: 11.5, // to the clone's right: the arm is held straight out, so bullets leave from the gun and converge on the cursor
  },

  sword: {
    name: 'Arc Blade',
    windup: 0.085,
    swing: 0.13,
    recover: 0.17,
    reach: 96,
    arcHalfAngle: 82, // degrees either side of aim
    hitTolerance: 30, // degrees: forgiveness around the blade angle each frame
    damage: 70,
    damageVariance: 0.12,
    cooldown: 0.8, // from the start of the wind-up to the next one
    lungeSpeed: 560,
    lungeDecay: 9,
    reserveRefund: 9, // reserve rounds returned per blade kill
    shieldRefund: 12,
    staggerRobot: 0.65,
    knockback: 260,
  },

  juice: {
    hitStopGunKill: 0.022,
    hitStopGunKillRobot: 0.04,
    hitStopSwordHit: 0.05,
    hitStopSwordKill: 0.065,
    hitStopRobotDeath: 0.09,
    swordHitTrauma: 0.32,
    swordKillTrauma: 0.42,
    robotDeathTrauma: 0.6,
    playerHurtTrauma: 0.38,
    swordZoomPunch: 0.022,
    robotDeathZoomPunch: 0.035,
    comboWindow: 1.6,
    heavyShotZoom: 0.02, // zoom thump per point of weapon heft above 1.2
    heavyShotRing: 0.12, // seconds the muzzle shockwave ring lives, times heft
  },

  // How gun hits land on enemies, scaled by the weapon's impact stat (SMG 0.5, magnum 1.6).
  impact: {
    sparks: 4, // extra spark particles per point of impact (robots)
    knock: 0.7, // knockback = base * (1 - knock/2 + knock * impact)
    heavyAt: 1.0, // impact at or above this gets hit-stop, shake and the heavy hit sound
    hitStop: 0.03, // per point of impact, once per trigger pull
    hitTrauma: 0.025,
    killStop: 0.03, // extra kill hit-stop per point of impact
    killTrauma: 0.03,
    resistSparks: 7, // sparks thrown when armour turns a round away
  },

  // Armour penetration against armour (Helldivers 2 style). Rows are AP minus the target's armour (MobDef.armour),
  // clamped to the table; values are the share of the damage that gets through.
  armour: {
    // diff <= -2, -1, 0, >= +1
    table: [0.35, 0.55, 0.8, 1],
  },

  // Bunker runs: wave budgets and what a lift ride restores.
  run: {
    budgetBase: 8,
    budgetPerDepth: 4,
    budgetPerWave: 3,
    firstSpawnDelay: 1.2,
    spawnGap: 0.8, // seconds between non-swarm spawns
    descendHeal: 0.35, // fraction of max hull restored on descending
    descendAmmo: 0.5, // fraction of max reserve restored on descending
    clearBonusItems: 1, // extra gear drops when the Warden falls, on top of its own
    waveIntelPerRoom: 2, // a room's waves count this many extra waves per room index toward Intel
  },

  waves: {
    intermission: 2.8,
    scavBase: 9,
    scavPerWave: 4,
    robotFromWave: 2,
    robotEvery: 1, // +1 robot every N waves after robotFromWave
    robotCap: 4,
    spawnStagger: 0.11,
    swarmSize: 16,
  },

  // Floating damage numbers.
  numbers: {
    life: 0.85,
    bladeLife: 1.05,
    rise: 95, // initial upward speed, px/s
    drag: 3.2,
    sideways: 30,
    jitter: 16, // random horizontal spawn offset, px
    popScale: 0.7,
    popTime: 0.12,
    gunSize: 15,
    bladeSize: 28,
    hurtSize: 21,
    shieldSize: 21,
    refundSize: 16,
    resistSize: 12,
    pool: { gun: 36, blade: 16, hurt: 8, shield: 8, refund: 8, resist: 24 },
  },

  extract: {
    padRadius: 70, // stand inside to extract
    exitAfterWave: 3, // waves cleared before the floor's exit pad opens (stand-in for the Warden)
  },

  loot: {
    pickupRadius: 26,
    magnetRadius: 110,
    magnetDelay: 0.4,
    magnetSpeed: 620,
    feedSeconds: 6,
  },
} as const;
