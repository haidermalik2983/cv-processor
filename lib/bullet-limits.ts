export const MAX_SECTION_BULLETS = 5;

export const BULLET_PREFIX_REGEX =
  /^[\s\u00A0\u2022\u2023\u2043\u2219\u25E6\u25AA\u25AB\u25CF\u25CB\u25A0\u25B8\u25B9•◦▪▫●○■▶▷\-*–—]+/u;

export const stripBulletPrefix = (value: string) =>
  value.replace(BULLET_PREFIX_REGEX, "").trim();

export type ParsedBulletEntry = {
  displayName: string;
  bullets: string[];
  /** Rebuild the entry's lines from a (possibly truncated) bullet list. */
  rebuild: (bullets: string[]) => string[];
};

export type EntryParser = (lines: string[]) => ParsedBulletEntry;

export const splitEntries = (content: string): string[][] =>
  content
    .trim()
    .split(/\n\s*\n/)
    .map((entry) => entry.split("\n").map((line) => line.trim()).filter(Boolean))
    .filter((entry) => entry.length > 0);

export type BulletTruncation = {
  entryName: string;
  originalCount: number;
};

export const truncateSectionBullets = (
  content: string,
  parseEntry: EntryParser,
  max: number = MAX_SECTION_BULLETS,
): { content: string; truncated: BulletTruncation[] } => {
  const entries = splitEntries(content);
  const truncated: BulletTruncation[] = [];

  const rebuiltEntries = entries.map((rawLines) => {
    const entry = parseEntry(rawLines);
    let bullets = entry.bullets;
    if (bullets.length > max) {
      truncated.push({
        entryName: entry.displayName,
        originalCount: bullets.length,
      });
      bullets = bullets.slice(0, max);
    }
    return entry.rebuild(bullets).join("\n");
  });

  return {
    content: rebuiltEntries.join("\n\n"),
    truncated,
  };
};

export type BulletOverflow = {
  entryName: string;
  count: number;
};

export const findOverflowingEntries = (
  content: string,
  parseEntry: EntryParser,
  max: number = MAX_SECTION_BULLETS,
): BulletOverflow[] => {
  const entries = splitEntries(content);
  const overflows: BulletOverflow[] = [];

  for (const rawLines of entries) {
    const entry = parseEntry(rawLines);
    if (entry.bullets.length > max) {
      overflows.push({
        entryName: entry.displayName,
        count: entry.bullets.length,
      });
    }
  }

  return overflows;
};
