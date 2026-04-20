import type { CodexEntry } from "./schemas/entry-types.ts";
import type { RelationshipEdge } from "./schemas/relationship.ts";

export function queryByType(entries: Map<string, CodexEntry>, type: string): CodexEntry[] {
  const result: CodexEntry[] = [];
  for (const entry of entries.values()) {
    if (entry.type === type) {
      result.push(entry);
    }
  }
  return result;
}

export function queryByTag(entries: Map<string, CodexEntry>, tag: string): CodexEntry[] {
  const result: CodexEntry[] = [];
  for (const entry of entries.values()) {
    if (entry.tags.includes(tag)) {
      result.push(entry);
    }
  }
  return result;
}

export function queryById(entries: Map<string, CodexEntry>, id: string): CodexEntry | undefined {
  return entries.get(id);
}

interface RelationshipFilter {
  readonly source_id?: string;
  readonly target_id?: string;
  readonly relation_type?: string;
}

export function queryRelationships(
  edges: readonly RelationshipEdge[],
  filter: RelationshipFilter,
): RelationshipEdge[] {
  return edges.filter((edge) => {
    if (filter.source_id !== undefined && edge.source_id !== filter.source_id) return false;
    if (filter.target_id !== undefined && edge.target_id !== filter.target_id) return false;
    if (filter.relation_type !== undefined && edge.relation_type !== filter.relation_type) return false;
    return true;
  });
}
