import { parse as parseYaml } from "yaml";
import { CodexEntrySchema, type CodexEntry } from "./schemas/entry-types.ts";
import { RelationshipEdgeSchema, type RelationshipEdge } from "./schemas/relationship.ts";

export async function loadCodexFile(filePath: string): Promise<CodexEntry[]> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const rawEntries = parseYaml(text);

  if (!Array.isArray(rawEntries)) {
    throw new Error(`Codex file ${filePath}: expected array of entries, got ${typeof rawEntries}`);
  }

  const validated: CodexEntry[] = [];

  for (let i = 0; i < rawEntries.length; i++) {
    const raw = rawEntries[i];
    const entryId = raw?.id ?? `(index ${i})`;
    const result = CodexEntrySchema.safeParse(raw);

    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `Codex file ${filePath}, entry "${entryId}" (index ${i}) validation failed:\n${issues}`
      );
    }

    validated.push(result.data);
  }

  return validated;
}

export async function loadRelationships(filePath: string): Promise<RelationshipEdge[]> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const rawEdges = parseYaml(text);

  if (!Array.isArray(rawEdges)) {
    throw new Error(`Relationships file ${filePath}: expected array, got ${typeof rawEdges}`);
  }

  const validated: RelationshipEdge[] = [];

  for (let i = 0; i < rawEdges.length; i++) {
    const raw = rawEdges[i];
    const result = RelationshipEdgeSchema.safeParse(raw);

    if (!result.success) {
      const sourceId = raw?.source_id ?? "(unknown)";
      const targetId = raw?.target_id ?? "(unknown)";
      const issues = result.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `Relationships file ${filePath}, edge ${sourceId}->${targetId} (index ${i}) validation failed:\n${issues}`
      );
    }

    validated.push(result.data);
  }

  return validated;
}

export async function loadAllCodex(codexDir: string): Promise<Map<string, CodexEntry>> {
  const { readdir } = await import("node:fs/promises");
  const allFiles = await readdir(codexDir);
  const files = allFiles.filter(
    (f) => f.endsWith(".yaml") && f !== "relationships.yaml" && f !== "guard-dialogue.yaml"
  );

  const entries = new Map<string, CodexEntry>();

  for (const file of files) {
    const filePath = `${codexDir}/${file}`;
    const fileEntries = await loadCodexFile(filePath);

    for (const entry of fileEntries) {
      if (entries.has(entry.id)) {
        throw new Error(
          `Duplicate codex entry id "${entry.id}" found in ${file}. First defined in codex.`
        );
      }
      entries.set(entry.id, entry);
    }
  }

  return entries;
}
