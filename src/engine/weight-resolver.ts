export type DialogueOptionEffect = {
  readonly raceId?: string;
  readonly professionWeights: Readonly<Record<string, number>>;
  readonly backgroundWeights: Readonly<Record<string, number>>;
  readonly tags: readonly string[];
};

export type AccumulatedWeights = {
  readonly raceId: string;
  readonly professionWeights: Readonly<Record<string, number>>;
  readonly backgroundWeights: Readonly<Record<string, number>>;
  readonly tags: readonly string[];
  readonly roundEffects: readonly DialogueOptionEffect[];
};

export type TiebreakerConfig = {
  readonly archetypePriority: {
    readonly profession: readonly string[];
    readonly background: readonly string[];
  };
  readonly questionPriority: {
    readonly profession: number;
    readonly background: number;
  };
};

export function createInitialWeights(): AccumulatedWeights {
  return {
    raceId: "",
    professionWeights: {},
    backgroundWeights: {},
    tags: [],
    roundEffects: [],
  };
}

function mergeWeights(
  current: Readonly<Record<string, number>>,
  incoming: Readonly<Record<string, number>>,
): Readonly<Record<string, number>> {
  const merged: Record<string, number> = { ...current };
  for (const [key, value] of Object.entries(incoming)) {
    merged[key] = (merged[key] ?? 0) + value;
  }
  return merged;
}

export function accumulateWeights(
  current: AccumulatedWeights,
  effect: DialogueOptionEffect,
  _roundIndex: number,
): AccumulatedWeights {
  return {
    raceId: effect.raceId ?? current.raceId,
    professionWeights: mergeWeights(
      current.professionWeights,
      effect.professionWeights,
    ),
    backgroundWeights: mergeWeights(
      current.backgroundWeights,
      effect.backgroundWeights,
    ),
    tags: [...current.tags, ...effect.tags],
    roundEffects: [...current.roundEffects, effect],
  };
}

type WeightCategory = "profession" | "background";

function getWeightFromEffect(
  effect: DialogueOptionEffect,
  category: WeightCategory,
  candidateId: string,
): number {
  const weights =
    category === "profession"
      ? effect.professionWeights
      : effect.backgroundWeights;
  return weights[candidateId] ?? 0;
}

function resolveByWeight(
  weights: Readonly<Record<string, number>>,
  category: WeightCategory,
  accumulated: AccumulatedWeights,
  config: TiebreakerConfig,
): string {
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "";

  const maxWeight = entries[0][1];
  const tied = entries.filter(([, w]) => w === maxWeight).map(([id]) => id);

  if (tied.length === 1) return tied[0];

  const lastEffect =
    accumulated.roundEffects.length > 0
      ? accumulated.roundEffects[accumulated.roundEffects.length - 1]
      : undefined;

  if (lastEffect) {
    const sortedByLastRound = [...tied].sort((a, b) => {
      const aWeight = getWeightFromEffect(lastEffect, category, a);
      const bWeight = getWeightFromEffect(lastEffect, category, b);
      return bWeight - aWeight;
    });

    const topLastWeight = getWeightFromEffect(
      lastEffect,
      category,
      sortedByLastRound[0],
    );
    const lastRoundTied = sortedByLastRound.filter(
      (id) => getWeightFromEffect(lastEffect, category, id) === topLastWeight,
    );

    if (lastRoundTied.length === 1) return lastRoundTied[0];

    const priorityRound = config.questionPriority[category];
    const priorityEffect = accumulated.roundEffects[priorityRound];

    if (priorityEffect) {
      const sortedByPriority = [...lastRoundTied].sort((a, b) => {
        const aWeight = getWeightFromEffect(priorityEffect, category, a);
        const bWeight = getWeightFromEffect(priorityEffect, category, b);
        return bWeight - aWeight;
      });

      const topPriorityWeight = getWeightFromEffect(
        priorityEffect,
        category,
        sortedByPriority[0],
      );
      const priorityTied = sortedByPriority.filter(
        (id) =>
          getWeightFromEffect(priorityEffect, category, id) ===
          topPriorityWeight,
      );

      if (priorityTied.length === 1) return priorityTied[0];

      const archetypeOrder = config.archetypePriority[category];
      const sortedByArchetype = [...priorityTied].sort((a, b) => {
        const aIdx = archetypeOrder.indexOf(a);
        const bIdx = archetypeOrder.indexOf(b);
        const aPos = aIdx === -1 ? Infinity : aIdx;
        const bPos = bIdx === -1 ? Infinity : bIdx;
        return aPos - bPos;
      });

      return sortedByArchetype[0];
    }

    const archetypeOrder = config.archetypePriority[category];
    const sortedByArchetype = [...lastRoundTied].sort((a, b) => {
      const aIdx = archetypeOrder.indexOf(a);
      const bIdx = archetypeOrder.indexOf(b);
      const aPos = aIdx === -1 ? Infinity : aIdx;
      const bPos = bIdx === -1 ? Infinity : bIdx;
      return aPos - bPos;
    });

    return sortedByArchetype[0];
  }

  const archetypeOrder = config.archetypePriority[category];
  const sortedByArchetype = [...tied].sort((a, b) => {
    const aIdx = archetypeOrder.indexOf(a);
    const bIdx = archetypeOrder.indexOf(b);
    const aPos = aIdx === -1 ? Infinity : aIdx;
    const bPos = bIdx === -1 ? Infinity : bIdx;
    return aPos - bPos;
  });

  return sortedByArchetype[0];
}

function resolveTopN(
  weights: Readonly<Record<string, number>>,
  n: number,
  category: WeightCategory,
  accumulated: AccumulatedWeights,
  config: TiebreakerConfig,
): readonly string[] {
  const entries = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  if (entries.length <= n) return entries.map(([id]) => id);

  const results: string[] = [];
  const remaining = new Map(entries);

  for (let i = 0; i < n; i++) {
    const currentEntries = [...remaining.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    if (currentEntries.length === 0) break;

    const maxWeight = currentEntries[0][1];
    const tied = currentEntries
      .filter(([, w]) => w === maxWeight)
      .map(([id]) => id);

    if (tied.length === 1) {
      results.push(tied[0]);
      remaining.delete(tied[0]);
    } else {
      const subWeights: Record<string, number> = {};
      for (const id of tied) {
        subWeights[id] = remaining.get(id) ?? 0;
      }
      const winner = resolveByWeight(subWeights, category, accumulated, config);
      results.push(winner);
      remaining.delete(winner);
    }
  }

  return results;
}

export function resolveCharacter(
  weights: AccumulatedWeights,
  config: TiebreakerConfig,
): {
  readonly name: string;
  readonly raceId: string;
  readonly professionId: string;
  readonly backgroundIds: readonly string[];
} {
  const professionId = resolveByWeight(
    weights.professionWeights,
    "profession",
    weights,
    config,
  );
  const backgroundIds = resolveTopN(
    weights.backgroundWeights,
    2,
    "background",
    weights,
    config,
  );

  return {
    name: "",
    raceId: weights.raceId,
    professionId,
    backgroundIds,
  };
}
