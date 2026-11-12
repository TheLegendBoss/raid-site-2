// What a deployment leaves behind, handed from the room to the base screen.
export interface MissionResult {
  missionId: string;
  outcome: 'extracted' | 'lost' | 'aborted';
  items: number; // banked into the stash
  scrap: number; // banked
  lost: number; // carried items (and carried scrap, counted as one) that were lost
  intel: number; // gained during the deployment
  wave: number;
  /** Rooms cleared and rooms in the run (0 for the dev test). */
  rooms: number;
  roomsTotal: number;
  /** The Warden fell and you got out: the bunker is claimed. */
  complete: boolean;
  /** Clear bonus paid on top (scrap, Intel). */
  bonusScrap: number;
  bonusIntel: number;
}
