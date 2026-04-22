import type { CodexEntry } from '../../codex/schemas/entry-types';

export type NpcFilterContext = {
  readonly npcId: string;
  readonly npcFactionIds: readonly string[];
  readonly npcProfession: string;
  readonly npcLocationId: string;
  readonly npcRegion: string;
};

export function filterCodexForNpc(
  entries: readonly CodexEntry[],
  npc: NpcFilterContext,
): readonly CodexEntry[] {
  return entries.filter(entry => {
    const ep = entry.epistemic;

    if (ep.known_by.includes(npc.npcId)) return true;

    if (ep.visibility === 'forbidden') return false;
    if (ep.visibility === 'secret' && !ep.known_by.includes(npc.npcId)) return false;
    if (ep.visibility === 'hidden' && !ep.known_by.includes(npc.npcId)) {
      for (const factionId of npc.npcFactionIds) {
        if (ep.known_by.includes(factionId)) return true;
      }
      if (ep.known_by.includes(npc.npcProfession)) return true;
      return false;
    }

    for (const factionId of npc.npcFactionIds) {
      if (ep.known_by.includes(factionId)) return true;
    }
    if (ep.known_by.includes(npc.npcProfession)) return true;

    if (
      ep.scope === 'regional' ||
      ep.scope === 'global' ||
      ep.scope === 'kingdom_wide'
    ) {
      if (ep.visibility === 'public') return true;
    }

    if (ep.visibility === 'public' && ep.authority !== 'canonical_truth') return true;
    if (ep.visibility === 'public') return true;
    if (ep.visibility === 'discovered') return false;

    return false;
  });
}
