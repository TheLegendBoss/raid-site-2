// Mission definitions for the mission-select screen. Numbers and copy only.
export interface MissionDef {
  id: string;
  name: string;
  tag: string;
  blurb: string;
  threats: string;
  rewards: string;
  /** When set, the mission cannot be deployed to and this is why. */
  locked?: string;
}

export const MISSIONS: readonly MissionDef[] = [
  {
    id: 'silo',
    name: 'SILO',
    tag: 'DISPOSABLE SITE',
    blurb: 'A sealed derelict, cut off from the network. Break in, take what the dead left, get out. Nothing here is connected to anything else, so nothing you do here is permanent.',
    threats: 'Scavengers in swarms, rogue maintenance robots',
    rewards: 'Gear, scrap, Intel',
    // The room is still the feel-test arena until the silo generator lands.
  },
  {
    id: 'vault',
    name: 'VAULT',
    tag: 'CONNECTED SITE',
    blurb: 'A persistent site with its own story. Claim it to wake its sleepers and grow the base.',
    threats: 'Unknown',
    rewards: 'Population, routes, story',
    locked: 'SEALED. No route yet. A silo may turn up a way in.',
  },
];

export const MISSION_BY_ID = new Map(MISSIONS.map((m) => [m.id, m]));
