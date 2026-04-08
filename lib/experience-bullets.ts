export const MAX_EXPERIENCE_BULLETS = 5;

const TECHNOLOGIES_LINE_REGEX = /^technologies\s*:?/i;

const BULLET_PREFIX_REGEX =
  /^[\s\u00A0\u2022\u2023\u2043\u2219\u25E6\u25AA\u25AB\u25CF\u25CB\u25A0\u25B8\u25B9•◦▪▫●○■▶▷\-*–—]+/u;

const stripBulletPrefix = (value: string) => value.replace(BULLET_PREFIX_REGEX, "").trim();

type ParsedExperienceEntry = {
  headerLine: string;
  roleLine: string;
  technologiesLine: string | null;
  bullets: string[];
};

const splitEntries = (content: string): string[][] =>
  content
    .trim()
    .split(/\n\s*\n/)
    .map((entry) => entry.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((entry) => entry.length > 0);

const parseEntry = (lines: string[]): ParsedExperienceEntry => {
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

  return { headerLine, roleLine, technologiesLine, bullets };
};

const entryDisplayName = (entry: ParsedExperienceEntry): string => {
  const header = entry.headerLine.trim();
  if (header) {
    const [companyWithLocation = header] = header.split(" — ");
    const [companyName = companyWithLocation] = companyWithLocation.split(",");
    const trimmed = companyName.trim();
    if (trimmed) return trimmed;
  }
  return entry.roleLine.trim() || "Untitled job";
};

export type ExperienceTruncation = {
  jobName: string;
  originalCount: number;
};

export const truncateExperienceBullets = (
  content: string,
): { content: string; truncated: ExperienceTruncation[] } => {
  const entries = splitEntries(content);
  const truncated: ExperienceTruncation[] = [];

  const rebuiltEntries = entries.map((rawLines) => {
    const entry = parseEntry(rawLines);
    if (entry.bullets.length > MAX_EXPERIENCE_BULLETS) {
      truncated.push({
        jobName: entryDisplayName(entry),
        originalCount: entry.bullets.length,
      });
      entry.bullets = entry.bullets.slice(0, MAX_EXPERIENCE_BULLETS);
    }

    const lines: string[] = [];
    if (entry.headerLine) lines.push(entry.headerLine);
    if (entry.roleLine) lines.push(entry.roleLine);
    if (entry.technologiesLine) lines.push(entry.technologiesLine);
    lines.push(...entry.bullets);
    return lines.join("\n");
  });

  return {
    content: rebuiltEntries.join("\n\n"),
    truncated,
  };
};

export type ExperienceOverflow = {
  jobName: string;
  count: number;
};

export const findOverflowingExperienceJobs = (content: string): ExperienceOverflow[] => {
  const entries = splitEntries(content);
  const overflows: ExperienceOverflow[] = [];

  for (const rawLines of entries) {
    const entry = parseEntry(rawLines);
    if (entry.bullets.length > MAX_EXPERIENCE_BULLETS) {
      overflows.push({
        jobName: entryDisplayName(entry),
        count: entry.bullets.length,
      });
    }
  }

  return overflows;
};
