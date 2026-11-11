// Every tunable number lives here. Logic never hard-codes a value.
// Units: pixels, seconds, degrees where noted.

export const TUNING = {
  world: { w: 2000, h: 1300, wall: 40 },

  camera: {
    zoom: 1,
    followLerp: 9, // higher = snappier
    lookAhead: 0.2, // fraction of player->cursor vector the camera leans toward
    traumaDecay: 1.7,
    shakeMaxOffset: 20,
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

  gun: {
    name: 'Carbine',
    fireDelay: 0.085,
    spread: 2.2, // degrees
    bulletSpeed: 1050,
    bulletLife: 0.9,
    damage: 11,
    maxAmmo: 90,
    ammoRegenPerSec: 2.5,
    recoilImpulse: 38,
    cameraKick: 3.2, // px opposite the aim per shot
    shotTrauma: 0.045,
    muzzleOffset: 28,
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
    lungeSpeed: 560,
    lungeDecay: 9,
    ammoRefund: 9,
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
  },

  scav: {
    radius: 12,
    hp: 22,
    speed: 150,
    speedJitter: 0.25,
    contactRange: 30,
    contactDamage: 8,
    attackCooldown: 0.75,
    separation: 24,
    knockbackDecay: 9,
    gunKnockback: 140,
    lootChance: 0.34,
  },

  robot: {
    radius: 21,
    hp: 120,
    speed: 78,
    preferredMin: 230,
    preferredMax: 340,
    telegraph: 0.6,
    burstCount: 3,
    burstGap: 0.1,
    cooldownMin: 1.7,
    cooldownMax: 2.6,
    bulletSpeed: 430,
    bulletDamage: 11,
    bulletLife: 2.2,
    gunKnockback: 25,
    lootMinRarity: 1,
    lootDrops: 2,
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

  loot: {
    pickupRadius: 26,
    magnetRadius: 110,
    magnetDelay: 0.4,
    magnetSpeed: 620,
    feedSeconds: 6,
  },
} as const;
