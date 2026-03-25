import fs from "node:fs/promises";
import path from "node:path";

export type SkillManifest = {
  id: string;
  summary: string;
  domains: string[];
  triggers: string[];
  readWhen: string[];
  examples: string[];
  path: string;
  body: string;
};

export type SelectedSkill = {
  id: string;
  path: string;
  reason: string;
  body: string;
};

export async function loadSkillManifests(rootDir: string): Promise<SkillManifest[]> {
  const skillsDir = path.join(rootDir, "docs", "skills");
  let entries: string[] = [];

  try {
    entries = await fs.readdir(skillsDir);
  } catch {
    return [];
  }

  const manifests: SkillManifest[] = [];
  for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
    const absolutePath = path.join(skillsDir, entry);
    const text = await fs.readFile(absolutePath, "utf8");
    const manifest = parseSkillManifest(text, path.relative(rootDir, absolutePath));
    if (manifest) {
      manifests.push(manifest);
    }
  }

  return manifests;
}

export function parseSkillManifest(text: string, relativePath: string): SkillManifest | null {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return null;
  }

  const frontMatter = parseFrontMatter(match[1]);
  if (!frontMatter.id || !frontMatter.summary) {
    return null;
  }

  return {
    id: frontMatter.id,
    summary: frontMatter.summary,
    domains: frontMatter.domains,
    triggers: frontMatter.triggers,
    readWhen: frontMatter.readWhen,
    examples: frontMatter.examples,
    path: relativePath,
    body: match[2].trim(),
  };
}

export function buildSkillsCatalog(manifests: SkillManifest[]): string {
  if (manifests.length === 0) {
    return "No semantic skills are configured.";
  }

  return manifests
    .map((manifest) => `- ${manifest.id}: ${manifest.summary} (details: ${manifest.path})`)
    .join("\n");
}

export function selectRelevantSkills(
  manifests: SkillManifest[],
  turnText: string,
  limit = 3,
): SelectedSkill[] {
  const scored = manifests
    .map((manifest) => {
      const score = scoreManifest(manifest, turnText);
      return {
        manifest,
        score: score.value,
        reasons: score.reasons,
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.manifest.id.localeCompare(right.manifest.id))
    .slice(0, limit);

  return scored.map((entry) => ({
    id: entry.manifest.id,
    path: entry.manifest.path,
    reason: entry.reasons.join("; "),
    body: entry.manifest.body,
  }));
}

export function buildSelectedSkillDetails(selectedSkills: SelectedSkill[]): string[] {
  return selectedSkills.map(
    (skill) => [`skill_id: ${skill.id}`, `doc_path: ${skill.path}`, `reason: ${skill.reason}`, skill.body].join(
      "\n",
    ),
  );
}

function scoreManifest(manifest: SkillManifest, turnText: string) {
  const reasons: string[] = [];
  let value = 0;
  const normalized = turnText.toLowerCase();

  for (const trigger of manifest.triggers) {
    if (matchesTrigger(trigger, turnText)) {
      value += 2;
      reasons.push(`trigger:${trigger}`);
    }
  }

  for (const domain of manifest.domains) {
    for (const keyword of domainKeywords(domain)) {
      if (matchesTrigger(keyword, normalized)) {
        value += 1;
        reasons.push(`domain:${domain}:${keyword}`);
      }
    }
  }

  return { value, reasons };
}

function matchesTrigger(trigger: string, turnText: string) {
  const normalized = turnText.toLowerCase();
  if (looksLikeRegex(trigger)) {
    try {
      return new RegExp(trigger, "i").test(turnText);
    } catch {
      return normalized.includes(trigger.toLowerCase());
    }
  }

  return normalized.includes(trigger.toLowerCase());
}

function looksLikeRegex(value: string) {
  return /[\\^$.*+?()[\]{}|]/.test(value);
}

function domainKeywords(domain: string) {
  switch (domain) {
    case "calendar":
      return ["meeting", "calendar", "schedule", "resched", "how many times", "practice", "class", "session"];
    case "email":
      return ["email", "draft", "message", "thread", "reply", "sender", "subject"];
    case "time":
      return ["today", "tomorrow", "tonight", "this evening", "next week", "next month", "friday", "monday"];
    default:
      return [];
  }
}

function parseFrontMatter(block: string) {
  const parsed = {
    id: "",
    summary: "",
    domains: [] as string[],
    triggers: [] as string[],
    readWhen: [] as string[],
    examples: [] as string[],
  };

  const lines = block.split("\n");
  let currentList:
    | "domains"
    | "triggers"
    | "readWhen"
    | "examples"
    | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const keyMatch = trimmed.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (keyMatch) {
      const [, rawKey, rawValue] = keyMatch;
      const key = normalizeFrontMatterKey(rawKey);
      currentList = isListKey(key) && !rawValue ? key : null;

      if (key === "id" || key === "summary") {
        parsed[key] = stripQuotes(rawValue);
      } else if (isListKey(key)) {
        const items = parseInlineList(rawValue);
        if (items.length > 0) {
          parsed[key].push(...items);
        }
      }
      continue;
    }

    if (currentList && trimmed.startsWith("- ")) {
      parsed[currentList].push(stripQuotes(trimmed.slice(2).trim()));
    }
  }

  return parsed;
}

function normalizeFrontMatterKey(key: string) {
  if (key === "read_when") {
    return "readWhen";
  }
  return key as "id" | "summary" | "domains" | "triggers" | "readWhen" | "examples";
}

function isListKey(
  key: string,
): key is "domains" | "triggers" | "readWhen" | "examples" {
  return key === "domains" || key === "triggers" || key === "readWhen" || key === "examples";
}

function parseInlineList(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed
      .slice(1, -1)
      .split(",")
      .map((item) => stripQuotes(item.trim()))
      .filter(Boolean);
  }
  return [stripQuotes(trimmed)];
}

function stripQuotes(value: string) {
  return value.replace(/^['"]|['"]$/g, "");
}
