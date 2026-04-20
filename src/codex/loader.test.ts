import { describe, it, expect, beforeAll } from "bun:test";
import { loadCodexFile, loadAllCodex } from "../loader.ts";
import { queryByType, queryByTag, queryById, queryRelationships } from "../query.ts";
import type { CodexEntry } from "../schemas/entry-types.ts";
import type { RelationshipEdge } from "../schemas/relationship.ts";
import { resolve } from "path";

const CODEX_DIR = resolve(import.meta.dir, "../../data/codex");

describe("loadCodexFile", () => {
  it("loads and validates locations.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "locations.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("location");
    }
  });

  it("loads and validates races.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "races.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("race");
    }
  });

  it("loads and validates professions.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "professions.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("profession");
    }
  });

  it("loads and validates factions.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "factions.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("faction");
    }
  });

  it("loads and validates npcs.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "npcs.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("npc");
    }
  });

  it("loads and validates spells.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "spells.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("spell");
    }
  });

  it("loads and validates items.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "items.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("item");
    }
  });

  it("loads and validates history_events.yaml", async () => {
    const entries = await loadCodexFile(resolve(CODEX_DIR, "history_events.yaml"));
    expect(entries.length).toBeGreaterThanOrEqual(2);
    for (const entry of entries) {
      expect(entry.type).toBe("history_event");
    }
  });

  it("throws on invalid YAML data with entry id and field info", async () => {
    const invalidYaml = `
- id: bad_entry
  name: "Bad"
  type: "race"
  tags: []
  description: "missing epistemic"
  traits: []
  abilities: []
`;
    const tmpPath = resolve(CODEX_DIR, "__test_invalid.yaml");
    await Bun.write(tmpPath, invalidYaml);
    try {
      await expect(loadCodexFile(tmpPath)).rejects.toThrow();
    } finally {
      const { unlinkSync } = await import("fs");
      unlinkSync(tmpPath);
    }
  });
});

describe("loadAllCodex", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("loads all entries keyed by id", () => {
    expect(codex.size).toBeGreaterThanOrEqual(16);
    expect(codex.has("race_human")).toBe(true);
    expect(codex.has("loc_north_gate")).toBe(true);
  });

  it("all entries are validated CodexEntry instances", () => {
    for (const [id, entry] of codex) {
      expect(entry.id).toBe(id);
      expect(typeof entry.type).toBe("string");
      expect(typeof entry.name).toBe("string");
    }
  });
});

describe("queryByType", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("returns only location entries", () => {
    const locations = queryByType(codex, "location");
    expect(locations.length).toBeGreaterThanOrEqual(2);
    for (const entry of locations) {
      expect(entry.type).toBe("location");
    }
  });

  it("returns only race entries", () => {
    const races = queryByType(codex, "race");
    expect(races.length).toBeGreaterThanOrEqual(2);
    for (const entry of races) {
      expect(entry.type).toBe("race");
    }
  });

  it("returns empty for nonexistent type", () => {
    const result = queryByType(codex, "nonexistent");
    expect(result).toEqual([]);
  });
});

describe("queryByTag", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("returns entries with playable tag", () => {
    const playable = queryByTag(codex, "playable");
    expect(playable.length).toBeGreaterThanOrEqual(2);
    for (const entry of playable) {
      expect(entry.tags).toContain("playable");
    }
  });

  it("returns empty for nonexistent tag", () => {
    const result = queryByTag(codex, "totally_nonexistent_tag_xyz");
    expect(result).toEqual([]);
  });
});

describe("queryById", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("returns the human race entry", () => {
    const entry = queryById(codex, "race_human");
    expect(entry).toBeDefined();
    expect(entry!.name).toBe("人类");
  });

  it("returns undefined for nonexistent id", () => {
    const entry = queryById(codex, "nonexistent_id");
    expect(entry).toBeUndefined();
  });
});

describe("queryRelationships", () => {
  let relationships: RelationshipEdge[];

  beforeAll(async () => {
    const { loadRelationships } = await import("../loader.ts");
    relationships = await loadRelationships(resolve(CODEX_DIR, "relationships.yaml"));
  });

  it("filters by source_id", () => {
    const guardEdges = queryRelationships(relationships, { source_id: "npc_guard" });
    expect(guardEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of guardEdges) {
      expect(edge.source_id).toBe("npc_guard");
    }
  });

  it("filters by target_id", () => {
    const tavernEdges = queryRelationships(relationships, { target_id: "loc_tavern" });
    expect(tavernEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of tavernEdges) {
      expect(edge.target_id).toBe("loc_tavern");
    }
  });

  it("filters by relation_type", () => {
    const memberEdges = queryRelationships(relationships, { relation_type: "member_of" });
    expect(memberEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of memberEdges) {
      expect(edge.relation_type).toBe("member_of");
    }
  });

  it("filters by multiple fields", () => {
    const result = queryRelationships(relationships, {
      source_id: "npc_guard",
      relation_type: "member_of",
    });
    expect(result.length).toBeGreaterThanOrEqual(1);
    for (const edge of result) {
      expect(edge.source_id).toBe("npc_guard");
      expect(edge.relation_type).toBe("member_of");
    }
  });

  it("returns empty for no match", () => {
    const result = queryRelationships(relationships, { source_id: "nonexistent" });
    expect(result).toEqual([]);
  });
});

describe("epistemic system demonstration", () => {
  let codex: Map<string, CodexEntry>;

  beforeAll(async () => {
    codex = await loadAllCodex(CODEX_DIR);
  });

  it("wolf disaster has canonical truth entry", () => {
    const wolfDisaster = queryById(codex, "event_wolf_disaster");
    expect(wolfDisaster).toBeDefined();
    expect(wolfDisaster!.epistemic.authority).toBe("established_canon");
    expect(wolfDisaster!.epistemic.truth_status).toBe("true");
  });

  it("wolf disaster rumor contradicts the canonical entry", () => {
    const wolfRumor = queryById(codex, "event_wolf_disaster_rumor");
    expect(wolfRumor).toBeDefined();
    expect(wolfRumor!.epistemic.authority).toBe("street_rumor");
    expect(wolfRumor!.epistemic.truth_status).toBe("partially_true");
    expect(wolfRumor!.epistemic.contradicts).toContain("event_wolf_disaster");
  });
});
