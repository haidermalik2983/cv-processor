import {
  MAX_SECTION_BULLETS,
  type EntryParser,
  type ParsedBulletEntry,
  findOverflowingEntries,
  stripBulletPrefix,
  truncateSectionBullets,
} from "./bullet-limits";

export const MAX_EXPERIENCE_BULLETS = MAX_SECTION_BULLETS;

const TECHNOLOGIES_LINE_REGEX = /^technologies\s*:?/i;

const parseExperienceEntry: EntryParser = (lines): ParsedBulletEntry => {
  const [headerLine = "", roleLine = "", ...rest] = lines;
  let technologiesLine: string | null = null;
  const bullets: string[] = [];

  for (const line of rest) {
    if (technologiesLine === null && TECHNOLOGIES_LINE_REGEX.test(stripBulletPrefix(line))) {
      technologiesLine = line;
      continue;
    }
    bullets.push(line);
  }

  const displayName = (() => {
    const header = headerLine.trim();
    if (header) {
      const [companyWithLocation = header] = header.split(" — ");
      const [companyName = companyWithLocation] = companyWithLocation.split(",");
      const trimmed = companyName.trim();
      if (trimmed) return trimmed;
    }
    return roleLine.trim() || "Untitled job";
  })();

  return {
    displayName,
    bullets,
    rebuild: (truncatedBullets) => {
      const out: string[] = [];
      if (headerLine) out.push(headerLine);
      if (roleLine) out.push(roleLine);
      if (technologiesLine) out.push(technologiesLine);
      out.push(...truncatedBullets);
      return out;
    },
  };
};

export type ExperienceTruncation = {
  jobName: string;
  originalCount: number;
};

export const truncateExperienceBullets = (
  content: string,
): { content: string; truncated: ExperienceTruncation[] } => {
  const result = truncateSectionBullets(content, parseExperienceEntry);
  return {
    content: result.content,
    truncated: result.truncated.map((t) => ({
      jobName: t.entryName,
      originalCount: t.originalCount,
    })),
  };
};

export type ExperienceOverflow = {
  jobName: string;
  count: number;
};

export const findOverflowingExperienceJobs = (content: string): ExperienceOverflow[] =>
  findOverflowingEntries(content, parseExperienceEntry).map((o) => ({
    jobName: o.entryName,
    count: o.count,
  }));
