import type { SaveDataV4, SaveDataV5, SaveDataV6 } from '../state/serializer';

type SaveDataCompare = SaveDataV4 | SaveDataV5 | SaveDataV6;

export type DiffCategory = 'quest' | 'npc_relation' | 'inventory' | 'location' | 'faction' | 'knowledge';
export type DiffMarker = '+' | '-' | '~';

export type DiffItem = {
  readonly category: DiffCategory;
  readonly marker: DiffMarker;
  readonly key: string;
  readonly description: string;
  readonly isHighImpact: boolean;
  readonly sourceValue?: string;
  readonly targetValue?: string;
};

export type BranchDiffResult = {
  readonly diffs: readonly DiffItem[];
  readonly totalCount: number;
  readonly highImpactCount: number;
  readonly summary: string;
};

const HIGH_IMPACT_QUEST_TRANSITIONS = new Set([
  'active->completed',
  'active->failed',
  'completed->failed',
  'failed->completed',
]);

const HIGH_IMPACT_RELATION_DELTA = 20;

const HIGH_IMPACT_KNOWLEDGE_TRANSITIONS = new Set([
  'heard->confirmed',
  'suspected->confirmed',
  'heard->contradicted',
  'suspected->contradicted',
]);

export function compareBranches(source: SaveDataCompare, target: SaveDataCompare): BranchDiffResult {
  const diffs: DiffItem[] = [];

  compareQuests(source, target, diffs);
  compareNpcRelations(source, target, diffs);
  compareInventory(source, target, diffs);
  compareLocation(source, target, diffs);
  compareFactionReputation(source, target, diffs);
  compareKnowledge(source, target, diffs);

  const highImpactCount = diffs.filter(d => d.isHighImpact).length;
  const summary = `${diffs.length} differences, ${highImpactCount} high-impact`;

  return { diffs, totalCount: diffs.length, highImpactCount, summary };
}

function compareQuests(source: SaveDataCompare, target: SaveDataCompare, diffs: DiffItem[]): void {
  const sourceQuests = source.quest.quests;
  const targetQuests = target.quest.quests;
  const allKeys = new Set([...Object.keys(sourceQuests), ...Object.keys(targetQuests)]);

  for (const questId of allKeys) {
    const src = sourceQuests[questId];
    const tgt = targetQuests[questId];

    if (src && !tgt) {
      diffs.push({
        category: 'quest',
        marker: '-',
        key: questId,
        description: `${questId} (${src.status})`,
        isHighImpact: src.status !== 'unknown',
        sourceValue: src.status,
      });
    } else if (!src && tgt) {
      diffs.push({
        category: 'quest',
        marker: '+',
        key: questId,
        description: `${questId} (${tgt.status})`,
        isHighImpact: tgt.status !== 'unknown',
        targetValue: tgt.status,
      });
    } else if (src && tgt && src.status !== tgt.status) {
      const transition = `${src.status}->${tgt.status}`;
      diffs.push({
        category: 'quest',
        marker: '~',
        key: questId,
        description: `${questId}: ${src.status} -> ${tgt.status}`,
        isHighImpact: HIGH_IMPACT_QUEST_TRANSITIONS.has(transition),
        sourceValue: src.status,
        targetValue: tgt.status,
      });
    }
  }
}

function compareNpcRelations(source: SaveDataCompare, target: SaveDataCompare, diffs: DiffItem[]): void {
  const srcDisps = source.relations.npcDispositions;
  const tgtDisps = target.relations.npcDispositions;
  const allKeys = new Set([...Object.keys(srcDisps), ...Object.keys(tgtDisps)]);

  for (const npcId of allKeys) {
    const srcDisp = srcDisps[npcId];
    const tgtDisp = tgtDisps[npcId];

    if (srcDisp && !tgtDisp) {
      diffs.push({
        category: 'npc_relation',
        marker: '-',
        key: npcId,
        description: `${npcId}: removed (was ${srcDisp.value})`,
        isHighImpact: Math.abs(srcDisp.value) >= HIGH_IMPACT_RELATION_DELTA,
        sourceValue: String(srcDisp.value),
      });
    } else if (!srcDisp && tgtDisp) {
      diffs.push({
        category: 'npc_relation',
        marker: '+',
        key: npcId,
        description: `${npcId}: added (${tgtDisp.value})`,
        isHighImpact: Math.abs(tgtDisp.value) >= HIGH_IMPACT_RELATION_DELTA,
        targetValue: String(tgtDisp.value),
      });
    } else if (srcDisp && tgtDisp && srcDisp.value !== tgtDisp.value) {
      const delta = Math.abs(tgtDisp.value - srcDisp.value);
      diffs.push({
        category: 'npc_relation',
        marker: '~',
        key: npcId,
        description: `${npcId}: ${srcDisp.value} -> ${tgtDisp.value}`,
        isHighImpact: delta >= HIGH_IMPACT_RELATION_DELTA,
        sourceValue: String(srcDisp.value),
        targetValue: String(tgtDisp.value),
      });
    }
  }
}

function compareInventory(source: SaveDataCompare, target: SaveDataCompare, diffs: DiffItem[]): void {
  const srcEquipped = new Set<string>();
  const tgtEquipped = new Set<string>();

  for (const [slot, item] of Object.entries(source.player.equipment)) {
    if (item !== null) {
      srcEquipped.add(`${slot}:${item}`);
    }
  }
  for (const [slot, item] of Object.entries(target.player.equipment)) {
    if (item !== null) {
      tgtEquipped.add(`${slot}:${item}`);
    }
  }

  for (const entry of srcEquipped) {
    if (!tgtEquipped.has(entry)) {
      const colonIdx = entry.indexOf(':');
      const slot = entry.slice(0, colonIdx);
      const item = entry.slice(colonIdx + 1);
      diffs.push({
        category: 'inventory',
        marker: '-',
        key: item,
        description: `${item} (${slot}) removed`,
        isHighImpact: false,
        sourceValue: entry,
      });
    }
  }

  for (const entry of tgtEquipped) {
    if (!srcEquipped.has(entry)) {
      const colonIdx = entry.indexOf(':');
      const slot = entry.slice(0, colonIdx);
      const item = entry.slice(colonIdx + 1);
      diffs.push({
        category: 'inventory',
        marker: '+',
        key: item,
        description: `${item} (${slot}) added`,
        isHighImpact: false,
        targetValue: entry,
      });
    }
  }

  const srcTags = new Set(source.player.tags);
  const tgtTags = new Set(target.player.tags);

  for (const tag of srcTags) {
    if (!tgtTags.has(tag)) {
      diffs.push({
        category: 'inventory',
        marker: '-',
        key: `tag:${tag}`,
        description: `tag ${tag} removed`,
        isHighImpact: false,
        sourceValue: tag,
      });
    }
  }

  for (const tag of tgtTags) {
    if (!srcTags.has(tag)) {
      diffs.push({
        category: 'inventory',
        marker: '+',
        key: `tag:${tag}`,
        description: `tag ${tag} added`,
        isHighImpact: false,
        targetValue: tag,
      });
    }
  }

  if (source.player.gold !== target.player.gold) {
    diffs.push({
      category: 'inventory',
      marker: '~',
      key: 'gold',
      description: `gold: ${source.player.gold} -> ${target.player.gold}`,
      isHighImpact: false,
      sourceValue: String(source.player.gold),
      targetValue: String(target.player.gold),
    });
  }
}

function compareLocation(source: SaveDataCompare, target: SaveDataCompare, diffs: DiffItem[]): void {
  if (source.scene.sceneId !== target.scene.sceneId) {
    diffs.push({
      category: 'location',
      marker: '~',
      key: 'current_location',
      description: `${source.scene.sceneId} -> ${target.scene.sceneId}`,
      isHighImpact: false,
      sourceValue: source.scene.sceneId,
      targetValue: target.scene.sceneId,
    });
  }
}

function compareFactionReputation(source: SaveDataCompare, target: SaveDataCompare, diffs: DiffItem[]): void {
  const srcFactions = source.relations.factionReputations;
  const tgtFactions = target.relations.factionReputations;
  const allKeys = new Set([...Object.keys(srcFactions), ...Object.keys(tgtFactions)]);

  for (const factionId of allKeys) {
    const srcVal = srcFactions[factionId];
    const tgtVal = tgtFactions[factionId];

    if (srcVal !== undefined && tgtVal === undefined) {
      diffs.push({
        category: 'faction',
        marker: '-',
        key: factionId,
        description: `${factionId}: removed (was ${srcVal})`,
        isHighImpact: Math.abs(srcVal) >= HIGH_IMPACT_RELATION_DELTA,
        sourceValue: String(srcVal),
      });
    } else if (srcVal === undefined && tgtVal !== undefined) {
      diffs.push({
        category: 'faction',
        marker: '+',
        key: factionId,
        description: `${factionId}: added (${tgtVal})`,
        isHighImpact: Math.abs(tgtVal) >= HIGH_IMPACT_RELATION_DELTA,
        targetValue: String(tgtVal),
      });
    } else if (srcVal !== undefined && tgtVal !== undefined && srcVal !== tgtVal) {
      const delta = Math.abs(tgtVal - srcVal);
      diffs.push({
        category: 'faction',
        marker: '~',
        key: factionId,
        description: `${factionId}: ${srcVal} -> ${tgtVal}`,
        isHighImpact: delta >= HIGH_IMPACT_RELATION_DELTA,
        sourceValue: String(srcVal),
        targetValue: String(tgtVal),
      });
    }
  }
}

function compareKnowledge(source: SaveDataCompare, target: SaveDataCompare, diffs: DiffItem[]): void {
  const srcEntries = source.playerKnowledge.entries;
  const tgtEntries = target.playerKnowledge.entries;
  const allKeys = new Set([...Object.keys(srcEntries), ...Object.keys(tgtEntries)]);

  for (const entryId of allKeys) {
    const src = srcEntries[entryId];
    const tgt = tgtEntries[entryId];

    if (src && !tgt) {
      diffs.push({
        category: 'knowledge',
        marker: '-',
        key: entryId,
        description: `${entryId}: removed (was ${src.knowledgeStatus})`,
        isHighImpact: false,
        sourceValue: src.knowledgeStatus,
      });
    } else if (!src && tgt) {
      diffs.push({
        category: 'knowledge',
        marker: '+',
        key: entryId,
        description: `${entryId}: discovered (${tgt.knowledgeStatus})`,
        isHighImpact: false,
        targetValue: tgt.knowledgeStatus,
      });
    } else if (src && tgt && src.knowledgeStatus !== tgt.knowledgeStatus) {
      const transition = `${src.knowledgeStatus}->${tgt.knowledgeStatus}`;
      diffs.push({
        category: 'knowledge',
        marker: '~',
        key: entryId,
        description: `${entryId}: ${src.knowledgeStatus} -> ${tgt.knowledgeStatus}`,
        isHighImpact: HIGH_IMPACT_KNOWLEDGE_TRANSITIONS.has(transition),
        sourceValue: src.knowledgeStatus,
        targetValue: tgt.knowledgeStatus,
      });
    }
  }
}
