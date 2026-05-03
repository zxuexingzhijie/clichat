import { describe, expect, it } from "bun:test";
import { parse as parseYaml } from "yaml";
import { resolve } from "path";
import { RelationshipEdgeSchema } from "./relationship.ts";

const legacyRelationship = {
  source_id: "npc_guard",
  target_id: "faction_guard",
  relation_type: "member_of",
  visibility: "public",
  strength: 0.9,
  status: "active",
  evidence: "wears guard uniform and badge",
  note: "loyal member since the wolf disaster",
};

describe("RelationshipEdgeSchema", () => {
  it("keeps legacy relationship edges valid", () => {
    const parsed = RelationshipEdgeSchema.parse(legacyRelationship);

    expect(parsed.source_id).toBe("npc_guard");
    expect(parsed.target_id).toBe("faction_guard");
    expect(parsed.relation_type).toBe("member_of");
  });

  it("accepts and preserves relationship v2 authoring fields", () => {
    const parsed = RelationshipEdgeSchema.parse({
      ...legacyRelationship,
      ai_grounding: {
        must_know: ["The guard serves the town watch."],
        must_not_invent: ["Do not claim the guard leads the faction."],
        reveal_policy: {
          default: "public_surface_only",
        },
      },
      ecology: {
        belief_hooks: [
          {
            holder_id: "npc_guard",
            holder_type: "npc",
            subject_id: "faction_guard",
            fact_id: "fact_guard_membership",
            stance: "knows",
            statement: "The guard knows their duty to the faction.",
            confidence: 0.95,
            when: "relationship_loaded",
          },
        ],
      },
    });

    expect(parsed.ai_grounding?.must_know).toEqual(["The guard serves the town watch."]);
    expect(parsed.ai_grounding?.reveal_policy?.default).toBe("public_surface_only");
    expect(parsed.ecology?.belief_hooks?.[0]?.holder_id).toBe("npc_guard");
    expect(parsed.ecology?.belief_hooks?.[0]?.when).toBe("relationship_loaded");
  });

  it("rejects unknown relationship v2 nested fields", () => {
    const result = RelationshipEdgeSchema.safeParse({
      ...legacyRelationship,
      ai_grounding: {
        must_know: ["Known fact"],
        unknown_nested_field: "should fail",
      },
    });

    expect(result.success).toBe(false);
  });

  it("all first-party relationship edges declare ai grounding", async () => {
    const relationshipsPath = resolve(
      import.meta.dir,
      "../../../world-data/codex/relationships.yaml",
    );
    const raw = parseYaml(await Bun.file(relationshipsPath).text()) as Array<{
      source_id?: string;
      target_id?: string;
      ai_grounding?: unknown;
    }>;
    const missingGrounding = raw
      .filter((edge) => !edge.ai_grounding)
      .map((edge) => `${edge.source_id ?? "(unknown)"}->${edge.target_id ?? "(unknown)"}`);

    expect(missingGrounding).toEqual([]);
  });
});
