export const DEFAULT_PROMPT_TEMPLATE = `
Enhance the following CV section against the provided job description.

Rules:
1) Improve and polish the existing section. Do not rewrite from scratch.
2) Maintain the candidate's original tone and voice.
3) Naturally incorporate relevant keywords from the job description.
4) Do not fabricate new experiences, skills, or qualifications.
5) For the EXPERIENCE section, preserve this exact block structure for each job:
   - Header line: Company, Location — Date
   - Role line
   - Technologies line in this exact format: Technologies: item1, item2, item3
   - Bullet lines
   Use only technologies already present or directly inferable from the original section content.
   Emit at most 5 bullet lines per job. Prefer the strongest, most job-relevant ones; merge or drop the rest.
   You MUST rewrite the Role line (job designation/title) for every job so it directly reflects the target job description. Do not leave the original Role line unchanged when relevant JD keywords exist. Apply these rules:
   - The new title must still describe the same kind of work the candidate actually did at that company. Do not invent a brand new job.
   - Replace generic specialization wording with specific specialization keywords drawn from the job description (e.g. "Full Stack Developer" → "React & Node.js Full Stack Developer"; "Backend Developer" → "Python / Django Backend Developer"). Choose the keywords that genuinely match the original work.
   - PRESERVE the original seniority level exactly. If the original said "Senior", keep "Senior". If it did not, do NOT add "Senior", "Lead", "Principal", "Head of", "Manager", or "Director". Never promote the candidate.
   - PRESERVE the original employment-type qualifier verbatim if present (e.g. "Freelancer & Consultant", "Contract", "Intern"). Append the new specialization to the same structure rather than removing these qualifiers.
   - Keep the same core role family. A Frontend Developer must not become a Backend Developer, DevOps Engineer, Data Engineer, or Product Manager. A Developer must not become an Architect.
   - Keep the title concise (roughly 4–9 words). Do not add company names, locations, dates, soft-skill phrases, or marketing language.
   - Plain text on a single line. No trailing punctuation, no dangling connectors ("&", "|", "/", "-", "and", "or", "with", "plus").
   - The result must read like a real job title a human would put on a CV — natural, specific, and believable.
6) For the PROJECTS section, emit at most 5 bullet lines per project. Prefer the strongest, most job-relevant ones; merge or drop the rest.
7) Return only the updated section content, without any preamble, bullets about what changed, or explanations.
8) If Section name is exactly "Professional Title":
   - Return exactly one ATS-friendly professional title tailored to the job description.
   - Keep it concise.
   - Use role + key specialization keywords only (no company names, no locations, no years).
   - The title must be a complete phrase and must not end with dangling connectors or symbols.
   - Forbidden ending tokens: "&", "|", "/", "-", "and", "or", "with", "plus".
   - Keep it plain text on a single line only.
`.trim();

export const REQUIRED_PROMPT_TOKENS = [
  "{{sectionName}}",
  "{{sectionContent}}",
  "{{jobDescription}}",
] as const;

const REQUIRED_PROMPT_CONTEXT_TEMPLATE = `
Section name: {{sectionName}}

Original section content:
{{sectionContent}}

Job description:
{{jobDescription}}
`.trim();

const LEGACY_REQUIRED_CONTEXT_REGEX =
  /(?:\n\s*)?Section name:\s*\{\{sectionName\}\}\s*\n+\s*Original section content:\s*\n+\s*\{\{sectionContent\}\}\s*\n+\s*Job description:\s*\n+\s*\{\{jobDescription\}\}\s*$/i;

export const normalizeEditablePromptTemplate = (template: string) => {
  const sanitizedTemplate = (template || "")
    .replace(LEGACY_REQUIRED_CONTEXT_REGEX, "")
    .replaceAll("{{sectionName}}", "")
    .replaceAll("{{sectionContent}}", "")
    .replaceAll("{{jobDescription}}", "")
    .trim();

  return sanitizedTemplate || DEFAULT_PROMPT_TEMPLATE;
};

export const buildPromptTemplateWithRequiredContext = (editableTemplate: string) => {
  const normalizedTemplate = normalizeEditablePromptTemplate(editableTemplate);
  return `${normalizedTemplate}\n\n${REQUIRED_PROMPT_CONTEXT_TEMPLATE}`;
};

export const applyPromptTemplate = (
  template: string,
  values: {
    sectionName: string;
    sectionContent: string;
    jobDescription: string;
  },
) => {
  return template
    .replaceAll("{{sectionName}}", values.sectionName)
    .replaceAll("{{sectionContent}}", values.sectionContent)
    .replaceAll("{{jobDescription}}", values.jobDescription)
    .trim();
};

