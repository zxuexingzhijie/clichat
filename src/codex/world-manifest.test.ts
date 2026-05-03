import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { WorldManifestSchema } from "../world-manifest-schema.ts";

const manifestPath = new URL("../../world-data/world-manifest.json", import.meta.url);

function readManifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

describe("world manifest metadata", () => {
  it("declares world-data authoring v2 schema metadata", () => {
    const manifest = readManifest();

    expect(manifest).toMatchObject({
      worldDataSchema: "2.0.0",
      migration: "world-data-authoring-v2",
    });

    const parsed = WorldManifestSchema.parse(manifest);
    expect(parsed).toEqual({
      version: "1.2.0",
      gameVersion: "1.5.0",
      generatedAt: "2026-05-03",
      worldDataSchema: "2.0.0",
      migration: "world-data-authoring-v2",
    });
  });

  const validManifest = {
    version: "1.2.0",
    gameVersion: "1.5.0",
    generatedAt: "2026-05-03",
    worldDataSchema: "2.0.0",
    migration: "world-data-authoring-v2",
  };

  it("rejects a manifest missing worldDataSchema", () => {
    const { worldDataSchema: _worldDataSchema, ...manifest } = validManifest;

    expect(WorldManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects a manifest with the wrong worldDataSchema", () => {
    const manifest = { ...validManifest, worldDataSchema: "1.0.0" };

    expect(WorldManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects a manifest with the wrong migration", () => {
    const manifest = { ...validManifest, migration: "legacy-authoring" };

    expect(WorldManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it.each([
    ["version", { ...validManifest, version: "1.2" }],
    ["gameVersion", { ...validManifest, gameVersion: "v1.5.0" }],
  ])("rejects a manifest with malformed semver %s", (_field, manifest) => {
    expect(WorldManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects a manifest with malformed generatedAt", () => {
    const manifest = { ...validManifest, generatedAt: "05/03/2026" };

    expect(WorldManifestSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects a manifest with unknown fields", () => {
    const manifest = { ...validManifest, unexpected: true };

    expect(WorldManifestSchema.safeParse(manifest).success).toBe(false);
  });
});
