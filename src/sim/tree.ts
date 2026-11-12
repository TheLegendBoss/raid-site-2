// Unlock rules for the research and perk trees. Pure TypeScript.
import { NODE_BY_ID, ROOT_IDS, TREE_NODES, type TreeId, type TreeNode } from '../data/tree';

export type UnlockCheck = { ok: true } | { ok: false; reason: 'unknown' | 'owned' | 'locked' | 'poor' };

export function initialUnlocked(): Set<string> {
  return new Set(ROOT_IDS);
}

export function checkUnlock(id: string, unlocked: ReadonlySet<string>, intel: number): UnlockCheck {
  const n = NODE_BY_ID.get(id);
  if (!n) return { ok: false, reason: 'unknown' };
  if (unlocked.has(id)) return { ok: false, reason: 'owned' };
  if (n.requires && !unlocked.has(n.requires)) return { ok: false, reason: 'locked' };
  if (intel < n.cost) return { ok: false, reason: 'poor' };
  return { ok: true };
}

/** Drop ids that no longer exist (renamed nodes) and nodes whose parent is missing. */
export function sanitizeUnlocked(ids: Iterable<string>): Set<string> {
  const out = initialUnlocked();
  const want = new Set(ids);
  // Walk in data order: parents are declared before their children.
  for (const n of TREE_NODES) {
    if (want.has(n.id) && (!n.requires || out.has(n.requires))) out.add(n.id);
  }
  return out;
}

export function nodesOf(tree: TreeId): TreeNode[] {
  return TREE_NODES.filter((n) => n.tree === tree);
}
