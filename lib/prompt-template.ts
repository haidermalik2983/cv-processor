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
6) Return only the updated section content, without any preamble, bullets about what changed, or explanations.
7) If Section name is exactly "Professional Title":
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

