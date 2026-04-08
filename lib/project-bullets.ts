import {
  BULLET_PREFIX_REGEX,
  MAX_SECTION_BULLETS,
  type EntryParser,
  type ParsedBulletEntry,
  findOverflowingEntries,
  truncateSectionBullets,
} from "./bullet-limits";

export const MAX_PROJECT_BULLETS = MAX_SECTION_BULLETS;

const isBulletLine = (line: string) => BULLET_PREFIX_REGEX.test(line);

const parseProjectEntry: EntryParser = (lines): ParsedBulletEntry => {
  const preamble: string[] = [];
  const bullets: string[] = [];
  let inBullets = false;

  for (const line of lines) {
    if (!inBullets && isBulletLine(line)) {
      inBullets = true;
    }
    if (inBullets) {
      bullets.push(line);
    } else {
      preamble.push(line);
    }
  }

  const displayName = (() => {
    const header = preamble[0]?.trim();
    if (header) {
      const [name = header] = header.split(",");
      const trimmed = name.trim();
      if (trimmed) return trimmed;
    }
    return "Untitled project";
  })();

  return {
    displayName,
    bullets,
    rebuild: (truncatedBullets) => [...preamble, ...truncatedBullets],
  };
};

export type ProjectTruncation = {
  projectName: string;
  originalCount: number;
};

export const truncateProjectBullets = (
  content: string,
): { content: string; truncated: ProjectTruncation[] } => {
  const result = truncateSectionBullets(content, parseProjectEntry);
  return {
    content: result.content,
    truncated: result.truncated.map((t) => ({
      projectName: t.entryName,
      originalCount: t.originalCount,
    })),
  };
};

export type ProjectOverflow = {
  projectName: string;
  count: number;
};

export const findOverflowingProjects = (content: string): ProjectOverflow[] =>
  findOverflowingEntries(content, parseProjectEntry).map((o) => ({
    projectName: o.entryName,
    count: o.count,
  }));
