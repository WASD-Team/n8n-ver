import type { VersionRow } from "@/lib/versionsStore";

const ALLOWED_PLACEHOLDERS = [
  "id",
  "w_id",
  "w_name",
  "w_version",
  "createdAt",
  "w_updatedAt",
  "w_json",
] as const;

type Placeholder = (typeof ALLOWED_PLACEHOLDERS)[number];

export function extractPlaceholders(template: string) {
  const matches = template.matchAll(/\{([a-zA-Z0-9_]+)\}/g);
  const found = new Set<string>();
  for (const match of matches) found.add(match[1]);
  return [...found];
}

export function validateTemplate(template: string) {
  const placeholders = extractPlaceholders(template);
  const unknown = placeholders.filter((p) => !ALLOWED_PLACEHOLDERS.includes(p as Placeholder));
  return {
    ok: unknown.length === 0,
    placeholders,
    unknown,
  };
}

function replaceAll(input: string, token: string, value: string) {
  return input.split(token).join(value);
}

export function applyTemplate(template: string, version: VersionRow) {
  const validation = validateTemplate(template);
  if (!validation.ok) {
    return { ok: false as const, error: `Unknown placeholders: ${validation.unknown.join(", ")}` };
  }

  const replacements: Record<Placeholder, string> = {
    id: String(version.id),
    w_id: version.w_id,
    w_name: version.w_name,
    w_version: version.w_version,
    createdAt: version.createdAt,
    w_updatedAt: version.w_updatedAt,
    w_json: version.w_json,
  };

  let rendered = template;
  for (const key of ALLOWED_PLACEHOLDERS) {
    const token = `{${key}}`;
    const value = key === "w_json" ? replacements[key] : replacements[key];
    rendered = replaceAll(rendered, token, value);
  }

  try {
    const json = JSON.parse(rendered);
    return { ok: true as const, rendered, json, placeholders: validation.placeholders };
  } catch (error) {
    return {
      ok: false as const,
      rendered,
      error: error instanceof Error ? error.message : String(error),
      placeholders: validation.placeholders,
    };
  }
}

