// ===========================================================================
// STAGE 2 — ENHANCE  (with section-type routing)
// ===========================================================================
//
// Drop-in replacement for the existing ENHANCE_PROMPT_TEMPLATE + runEnhance
// in cv-pipeline.ts. Same exported runEnhance signature — no other files
// need to change.

import { applyPromptTemplate } from "./prompt-template";



export class PipelineError extends Error {
  constructor(
    public readonly stage: "analyze" | "enhance" | "score",
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`[${stage}] ${message}`);
    this.name = "PipelineError";
  }
}
// ---------- Section type detection ----------------------------------------

export type SectionType =
  | "professional_title"
  | "summary"
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "default";

const TITLE_NAMES = new Set([
  "professional title",
  "title",
  "headline",
  "professional headline",
]);

const SUMMARY_NAMES = new Set([
  "summary",
  "professional summary",
  "profile",
  "professional profile",
  "about",
  "about me",
]);

const SKILLS_NAMES = new Set([
  "skills",
  "technical skills",
  "core skills",
  "key skills",
  "competencies",
]);

const EXPERIENCE_NAMES = new Set([
  "experience",
  "work experience",
  "professional experience",
  "employment",
  "employment history",
]);

const PROJECTS_NAMES = new Set([
  "projects",
  "personal projects",
  "side projects",
  "selected projects",
]);

const EDUCATION_NAMES = new Set([
  "education",
  "academic background",
  "qualifications",
  "degrees",
]);

export const detectSectionType = (sectionName: string): SectionType => {
  const normalized = sectionName.trim().toLowerCase();
  if (TITLE_NAMES.has(normalized)) return "professional_title";
  if (SUMMARY_NAMES.has(normalized)) return "summary";
  if (SKILLS_NAMES.has(normalized)) return "skills";
  if (EXPERIENCE_NAMES.has(normalized)) return "experience";
  if (EDUCATION_NAMES.has(normalized)) return "education";
  if (PROJECTS_NAMES.has(normalized)) return "projects";
  return "default";
};


export const ENHANCE_EDUCATION_SYSTEM_PROMPT = `
  You are a CV formatting normalizer for Education sections. Your only job is to reformat the candidate's existing education content into a strict two-line layout. You
  do not evaluate, score, rewrite for impact, or align to any job description.

  Operating rules:
  - You preserve the candidate's institution name, location, dates, and degree exactly as given. You fix only spelling, capitalization, and separators/format.
  - You never invent, embellish, translate, or add content not present in the original. If a field is missing, you omit it cleanly rather than guessing.                 
  - You output only the formatted two-line block. No preamble, no commentary, no markdown, no explanation.                                                               
  `.trim();



export const ENHANCE_EDUCATION_PROMPT_TEMPLATE = `                                                                                                                     
  You are normalizing the Education section of a CV into a strict two-line format. This is a formatting pass, not a rewrite. Do NOT invent, embellish, translate, or     
  rephrase the candidate's education content. Do NOT score or evaluate.                                                                                                  
   
  ## OUTPUT FORMAT — EXACT, TWO LINES                                                                                                                                    
                                                                                                                                                                         
  Line 1: Institution Name, Location — Date Range
  Line 2: Degree                                                                                                                                                         
                                                                                                                                                                         
  Example:                                                                                                                                                               
  University of Punjab, Lahore — Sep 2018 – Jun 2022                                                                                                                     
  Bachelor of Science in Computer Science                                                                                                                                
   
  ## RULES                                                                                                                                                               
                  
  - Output exactly two lines. No blank lines, no headers, no preamble, no markdown.
  - Use an em dash with surrounding spaces (" — ") as the separator between Location and Date Range on Line 1. Use an en dash with surrounding spaces (" – ") inside the
  Date Range itself.
  - Comma between Institution Name and Location.
  - Date Range format: "Mon YYYY – Mon YYYY" (e.g. "Sep 2018 – Jun 2022"). If only years are given in the original, keep year-only ("2018 – 2022"). If end date is
  current, use "Sep 2022 – Present". Do not invent months or years that are not in the original.
  - If Location is missing in the original, omit it AND the comma: "Institution — Date Range".
  - If Date Range is missing in the original, omit the em dash too: "Institution, Location" or "Institution".
  - If Degree is missing in the original, omit Line 2 entirely (output one line).
  - Preserve the candidate's actual institution name, location, dates, and degree exactly as given. Fix only spelling, capitalization, and the separator/format.
  - If the original lists multiple degrees or institutions, output only the most recent / highest-level one (two lines max).

  ## DEGREE LINE — STRIP ELABORATION

  The Degree line must contain ONLY the degree name. Strip every clause that elaborates beyond the degree itself.

  - KEEP: the degree name, including its abbreviation in parentheses and its subject. Examples that are correct as-is:
    - "Master of Computer Science (MCS)"
    - "Master of Science in Computer Science"
    - "Bachelor of Science in Software Engineering"
    - "BSc Computer Science"
  - STRIP everything from the degree line that follows a comma, dash, em dash, parenthetical-after-the-abbreviation, or any of these connectors: "with", "with coursework in", "with focus on", "focused on", "specializing in", "specialization in", "concentration in", "concentrating in", "emphasizing", "emphasis on", "including", "covering", "thesis on", "minor in", "Honours in", "(GPA ...)", "GPA ...".
  - STRIP all coursework lists, thesis topics, research areas, awards, GPA, honors, and JD-aligned framing — even if present in the original. The Education section is for credential + institution + dates only.
  - The degree line should be at most ~10 words. If it is longer, you have not stripped enough.

  ### BEFORE → AFTER (degree-line cleanup)

  - "Master of Computer Science (MCS), with coursework in product-focused software engineering, human-computer interaction (HCI), and user interface development for technical users, emphasizing interaction patterns and workflows for complex engineering tools" → "Master of Computer Science (MCS)"
  - "Bachelor of Science in Computer Science — specializing in distributed systems, GPA 3.8/4.0, thesis on consensus algorithms" → "Bachelor of Science in Computer Science"
  - "BSc Software Engineering, with minor in Mathematics and Honours in AI" → "BSc Software Engineering"                                             
                                                                                                                                                                         
  ## INPUT                                                                                                                                                               
                                                                                                                                                                         
  Original education content:
  {{sectionContent}}

  ## OUTPUT

  Return only the two-line formatted education block. No preamble, no commentary, no markdown.
  `.trim(); 



export const ENHANCE_SYSTEM_PROMPT = `
You are a CV section rewriter targeting a specific job description. You take a structured analysis and apply it to produce a revised section that aligns the candidate's CV to the JD as closely as possible.

Operating rules:
- The job description is the source of truth for what content the section should contain. The original section is used only to anchor companies, date ranges, and role seniority.
- You may add technologies, methodologies, bullets, metrics, and focus areas that align with the JD even if they are not present in the original section. Generate content that fits the JD's priorities for someone at this seniority and tenure.
- You preserve company names, date ranges, and role seniority verbatim from the original. Never promote the candidate to a higher seniority than the original states (a "Senior" stays "Senior"; a non-senior does not become "Senior").
- You output only the rewritten section. No preamble, no commentary, no markdown.
`.trim();

// ---------- Prompt: Professional Title ------------------------------------

export const ENHANCE_TITLE_PROMPT_TEMPLATE = `
You are rewriting the Professional Title line of a CV — a SINGLE LINE that appears at the top of the document under the candidate's name. This is not a Skills section, not a Summary, not an Experience role line. It is one short headline.

## HARD CONSTRAINTS

- Output: exactly ONE line. Plain text. No newlines, no markdown.
- Length: maximum 10 words. Aim for 6–9. Anything longer is wrong.
- Maximum ONE pipe (|) separator. Two parts max: "Role | Specialization". Never use multiple pipes to chain keywords.
- The specialization (right of the pipe) is 2–4 words max — a domain or stack label, not a list of tasks or responsibilities.
- No companies, no locations, no years, no soft skills.
- No trailing connectors ("&", "|", "/", "-", "and", "or", "with", "plus").
- No keyword stuffing. A title with 5+ keywords looks fake to ATS and humans.
- Do not copy multi-word phrases verbatim from the JD. The title must not read like it was lifted from the job post. Distinctive single-word keywords (e.g. "Shopify", "LLM", "GraphQL") are fine; full job-post chunks (e.g. "Client & Vendor Onboarding") are not.
- Use title case ("Senior Systems Integration Engineer"). If the original is ALL CAPS, normalize it.

## RULES

- Preserve original seniority verbatim. If original says "Senior", keep "Senior". If original is silent on seniority, do NOT add "Senior", "Lead", "Principal", or any other promotion.
- Preserve employment-type qualifiers if present in the original ("Contract", "Freelancer", "Intern").
- Choose ONE primary specialization from the JD's most prominent ask. The JD is the source of truth — pick the specialization the JD foregrounds, even if the original CV emphasizes something different.
- Generalize the specialization to a domain or stack label, not a task or scope description.
  - Right level (domain/stack): "E-commerce & Shopify Integrations", "LLM Agentic Systems", "Distributed Systems", "React & Design Systems".
  - Wrong level (task/scope): "Client & Vendor Onboarding", "Order Provisioning & Tax Engines", "Migrating Magento to Shopify".
- The title must read like a real headline a human recruiter would expect, not a search-engine string.

## EXAMPLES

GOOD examples (real-feeling, focused, ATS-friendly):
- "Senior TypeScript Full-Stack Engineer"
- "Senior Full-Stack Engineer | LLM Agentic Systems"
- "Backend Engineer | Distributed Systems"
- "Senior Frontend Engineer | React & Design Systems"
- "Senior Product Engineer | AI Agents"
- "Senior Systems Integration Engineer | E-commerce & Shopify Integrations"

BEFORE → AFTER (the rewrite pattern to internalize):
- "SENIOR SYSTEMS INTEGRATION ENGINEER | E-COMMERCE SHOPIFY CLIENT & VENDOR ONBOARDING" → "Senior Systems Integration Engineer | E-commerce & Shopify Integrations"
  Why: original was ALL CAPS, too long, and copied JD task phrasing ("Client & Vendor Onboarding"). The rewrite keeps the role and the two highest-signal keywords (E-commerce, Shopify), and generalizes the specialization to a domain label.

BAD examples (avoid these patterns):
- "Senior TypeScript Full-Stack Engineer | Strong backend fundamentals | Production LLM agentic systems | AI-native workflow | Fastify, PostgreSQL, Prisma..." (keyword dump, multiple pipes, way too long)
- "Senior Full-Stack Developer with TypeScript, React, Node.js, PostgreSQL, Redis, and AWS experience" (kitchen-sink list)
- "Senior Systems Integration Engineer | E-commerce Shopify Client & Vendor Onboarding" (JD task phrasing copied verbatim, too long)
- "Lead Senior Principal Engineer" (promotion, redundant seniority)
- "Full-Stack Developer at Google" (company name)

## ANALYSIS GUIDANCE

The provided analysis lists keywords and gaps for the FULL CV — but the title is one line. Treat the analysis as advisory, not as a checklist. Pick the single most JD-aligned specialization and ignore the rest.

The JD is the source of truth: pick the specialization the JD foregrounds, even if the original title emphasizes something different. You do not need to limit yourself to specializations the original CV explicitly named.

## INPUT

Original title:
{{sectionContent}}

Job description:
{{jobDescription}}

Analysis (advisory only — pick ONE specialization, do not include all keywords):
{{analysis}}

## OUTPUT

Return only the new title. One line. No preamble, no explanation, no quotes around it.
`.trim();

// ---------- Prompt: Summary -----------------------------------------------

export const ENHANCE_SUMMARY_PROMPT_TEMPLATE = `
You are rewriting the Summary section of a CV — a short paragraph (3–5 lines) that appears near the top of the document.

## HARD CONSTRAINTS

- 2 to 3 lines, roughly 20–30 words total. Not a paragraph block, not a wall of text.
- No first-person pronouns ("I", "me", "my").
- No markdown formatting.
- No keyword stuffing — keywords must appear in grammatical sentences, not as comma-separated lists.

## STRUCTURE

Line 1: Role + seniority + primary specialization tailored to the JD.
Lines 2–3: 1–2 concrete strengths or focus areas, drawn from the original content, that match top JD priorities.
Line 4 (optional): One sentence on impact, scope, or product area if supported by original content.
Final line (optional): What the candidate is looking for or known for, only if the original supported it.

## RULES

- Preserve original seniority. Never promote.
- The JD is the source of truth for content. Generate a summary that aligns the candidate to this JD: lead with the JD's primary specialization, weave in 4–6 of the top JD keywords naturally (sentences, not lists), and use the JD's exact phrasing where natural.
- Use the original summary only to anchor seniority and tenure (years of experience). Focus areas, technologies, and strengths should reflect what the JD prioritizes.

## EXAMPLE STRUCTURE (do not copy content)

"Senior TypeScript Full-Stack Engineer with 7 years building production web platforms and LLM-powered features. Strong backend fundamentals across API design, data modeling, and concurrency. Recent work focused on tool-calling, streaming, and prompt iteration in production agentic systems. Comfortable shipping end-to-end in small teams using AI-native workflows."

## INPUT

Original summary:
{{sectionContent}}

Job description:
{{jobDescription}}

Analysis (apply addressable gaps; skip Do Not Fabricate items):
{{analysis}}

## OUTPUT

Return only the new summary. Plain text. No preamble.
`.trim();

// ---------- Prompt: Skills ------------------------------------------------

export const ENHANCE_SKILLS_PROMPT_TEMPLATE = `
You are rewriting the Skills section of a CV. Output must be clean, ATS-friendly, and easy for a recruiter to scan — not a packed paragraph.

## OUTPUT FORMAT (STRICT)

- Group skills into categories. Always group, even if the original was a flat list.
- Each group is exactly two lines:
  - Line 1: the category name followed by a colon. Example: "Integration Methods:"
  - Line 2: a comma-separated list of skills in that category.
- Separate groups with a single blank line.
- Plain text only. No markdown, no bullet characters, no bolding, no inline category labels mid-paragraph.

Exact shape (do not copy content, only the structure):

Category A:
skill, skill, skill, skill

Category B:
skill, skill, skill, skill, skill

## SIZE CONSTRAINTS

- Produce 4 to 6 groups.
- Each group contains 4 to 8 skills.
- Total skills across the section: roughly 20 to 30. Do not exceed 35.
- No duplicates across groups. A skill belongs to exactly one category.

## CONTENT RULES

- Hard skills only — tools, languages, frameworks, platforms, methodologies, certifications. No soft skills (e.g. "communication", "leadership").
- No version numbers unless the JD explicitly specifies them.
- The JD is the source of truth for priority. Every skill must directly map to a JD priority, technology, methodology, or domain — or be a clearly supporting peer skill that a recruiter for this JD would expect to see.
- ADD: exact-match keywords, technologies, and methodologies from the JD, even if the original CV did not name them, as long as the candidate's experience genuinely supports them (use the analysis to judge).
- KEEP from the original: skills that align with or extend the JD's stack.
- DROP: anything off-topic relative to the JD, anything keyword-stuffed, and any skill the analysis flags as not supported by the candidate's background.

## CATEGORY RULES

- Pick category names that reflect the JD's domain (examples: "E-commerce Platforms", "Integration Methods", "Business Systems", "Cloud & Data", "Languages", "Frontend", "Backend", "Testing & Quality", "DevOps & Delivery", "Delivery & Operations"). Do not invent obscure or overlapping labels.
- Order categories from highest JD relevance to lowest.
- Within each category, order skills by JD relevance, highest first.
- Distribute skills across categories — do not pack one category with 10+ skills while others have 1–2.

## EXAMPLE (structure only, do not copy content)

If the JD is for a Shopify integrations engineer, a correct output looks like:

E-commerce Platforms:
Shopify, Shopify Admin API, Shopify Webhooks, Magento

Integration Methods:
REST APIs, Webhooks, EDI, JSON, XML, Streaming, Data Mapping

Business Systems:
ERP, OMS, PIM, CRM, Payments, Tax Engines, Product Catalogues, Order Provisioning

Cloud & Data:
AWS, SQL, Analytics, Reporting, Monitoring

Delivery & Operations:
Agile, Client Onboarding, Stakeholder Management, Root Cause Analysis

A WRONG output (do not produce this) is a single dense paragraph with bolded labels and skills running together across multiple lines without blank-line separation between groups.

## INPUT

Original skills:
{{sectionContent}}

Job description:
{{jobDescription}}

Analysis (apply addressable gaps; skip Do Not Fabricate items):
{{analysis}}

## OUTPUT

Return only the new Skills section in the exact shape above. No preamble, no trailing notes.
`.trim();

// ---------- Prompt: Experience / Projects / Default -----------------------

export const ENHANCE_DEFAULT_PROMPT_TEMPLATE = `
You are rewriting one section of a CV to align with a specific job description. You have been given a structured analysis of what to fix. Apply it.

## YOU MUST USE THE PROVIDED ANALYSIS

The analysis has these sections, each with stable labels you can reference:

- "JD Priorities:" — what the JD is optimizing for
- "Current Section Signal:" — what the section currently signals
- "Positioning Gaps:" — entries [P1], [P2], [P3] with Severity, Issue, Fix, JD Evidence, Section Evidence
- "ATS Gaps:" — entries [A1] through [A5] with Type, Issue, Fix
- "Missing Keywords from JD:" — exact-match keywords to weave in naturally

How to apply:

- For each Positioning Gap: execute its Fix directly. The Fix is an instruction, not a suggestion.
- Address positioning gaps in severity order: high → medium → low.
- Apply every ATS Gap Fix.
- Weave every Missing Keyword into a contextually meaningful bullet, using the JD's exact phrasing. Do not list keywords mechanically.

## CORE RULES

1) The job description is the source of truth for content. Preserve company names, date ranges, and seniority verbatim from the original section — these are anchors. Everything else (technologies, bullets, focus areas, metrics, framing) should be generated to align this section with the JD.

2) You may add JD-relevant technologies, methodologies, bullets, and metrics that are plausible for someone at the candidate's seniority and tenure — they do not need to be present in the original section.

3) Use exact JD phrasing for technologies, keywords, and concepts. Prefer JD wording over synonyms (e.g., if JD says "tool-calling", write "tool-calling", not "function calling").

4) Keep the rewrite internally consistent: a 3-year engineer should not have 10 years of distributed-systems experience; metrics should be plausible for the role's scope; bullets within a single job should hang together coherently.

## OUTPUT FORMAT

5) Return only the rewritten section content. No preamble, no change log, no explanations.

6) Plain text only. No markdown (**, *, #, backticks).

7) ATS-safe formatting:
   - Consistent date format throughout (e.g., "Jan 2022 – Mar 2024")
   - Straight quotes (' "), not curly
   - No decorative unicode (✓, →, ★)
   - No tables, columns, or text boxes
   - No tabs or multi-space alignment

## EXPERIENCE SECTION STRUCTURE

8) Preserve this block structure for each job:
   Header line: Company, Location — Date
   Role line
   Tech Stack line: Tech Stack: item1, item2, item3
   Bullet lines (2 to 3 per job, max 3 — keep only the most JD-relevant bullets, drop or merge the rest)

   The Tech Stack line should reflect the JD's stack. List the JD's technologies that fit the role's seniority/tenure, supplemented by any original technologies still relevant.

9) Role line rewriting: incorporate JD-specific specialization keywords (e.g. "Full Stack Developer" → "TypeScript Full Stack Engineer" if the JD foregrounds TypeScript). Preserve original seniority verbatim — never promote (no adding "Senior", "Lead", "Principal" if absent in the original). Preserve employment-type qualifiers (e.g. "Contract", "Freelancer & Consultant"). Keep title 4–9 words. No trailing connectors.

## PROJECTS SECTION

10) 2 to 3 bullets per project, max 3. Pick only the most JD-relevant bullets — drop or merge the rest.

## BULLET WRITING RULES

11) Every bullet starts with a strong action verb in the right tense:
    - Past tense for prior roles ("Built", "Designed", "Owned", "Shipped", "Reduced", "Migrated")
    - Present tense ONLY for the candidate's current role
    - No bullets starting with: "Responsible for", "Worked on", "Helped with", "Assisted in", "Involved in", or articles ("A", "The")

12) Follow Problem → Action → Impact.

13) Quantify with plausible numbers — metrics should be realistic for the role's scope, seniority, and tenure. Round numbers (e.g. 30%, 40%, 2x) are fine and read as authentic.

14) Keep bullets to 1–2 lines (15–30 words).

15) Reorder bullets to lead with: user/stakeholder impact → product ownership → system/backend work → performance metrics, weighted toward what the JD foregrounds.



## INPUT

Section name: {{sectionName}}

Original section content:
{{sectionContent}}

Job description:
{{jobDescription}}

Analysis (apply this):
{{analysis}}
`.trim();

// ---------- Router --------------------------------------------------------

export const getEnhancePromptTemplate = (sectionType: SectionType): string => {
  switch (sectionType) {
    case "professional_title":
      return ENHANCE_TITLE_PROMPT_TEMPLATE;
    case "summary":
      return ENHANCE_SUMMARY_PROMPT_TEMPLATE;
    case "skills":
      return ENHANCE_SKILLS_PROMPT_TEMPLATE;
    case "education":
      return ENHANCE_EDUCATION_PROMPT_TEMPLATE;
    case "experience":
    case "projects":
    case "default":
    default:
      return ENHANCE_DEFAULT_PROMPT_TEMPLATE;
  }
};

// ---------- runEnhance (replaces existing one) ----------------------------

export interface RunEnhanceOptions {
  sectionName: string;
  sectionContent: string;
  jobDescription: string;
  analysis: string;
}

export interface ReviewedSection {
    section_name: string;
    top_priority_fix: string;
    total_score: number;
    criteria: Array<{
        name: string;
        reason: string;
        score: number;
        suggestion: string;
    }>;
}

export type FullCVReviewSectionKey =
  | "headline"
  | "summary"
  | "skills"
  | "workExperience"
  | "education"
  | "projects";

export interface FullCVSectionNote {
  score: number;
  note: string;
  fix: string;
}

export interface FullCVCrossSectionIssue {
  issue: string;
  sections_involved: FullCVReviewSectionKey[];
  fix: string;
}

export interface FullCVReview {
  overall_score: number;
  recruiter_summary: string;
  cross_section_issues: FullCVCrossSectionIssue[];
  per_section_notes: Partial<Record<FullCVReviewSectionKey, FullCVSectionNote>>;
  top_priority_fix: string;
  top_priority_sections?: FullCVReviewSectionKey[];
}

// export const runEnhance = async ({
//   sectionName,
//   sectionContent,
//   jobDescription,
//   analysis,
// }: RunEnhanceOptions): Promise<string> => {
//   const sectionType = detectSectionType(sectionName);
//   const template = getEnhancePromptTemplate(sectionType);

//   const prompt = applyPromptTemplate(template, {
//     sectionName,
//     sectionContent,
//     jobDescription,
//     analysis,
//   });

//   // Tighter token budget for short-form sections
//   const maxTokens =
//     sectionType === "professional_title"
//       ? 60
//       : sectionType === "summary"
//         ? 250
//         : sectionType === "skills"
//           ? 500
//           : undefined;

//   // Slightly cooler for short-form (less room for creative drift)
//   const temperature = sectionType === "professional_title" ? 0.3 : 0.5;

//   let response;
//   try {

//     response = await client.chat.completions.create({
//       model,
//       messages: [{ role: "user", content: prompt }],
//       temperature,
//       ...(maxTokens ? { max_tokens: maxTokens } : {}),
//     });
//   } catch (err) {
//     throw new PipelineError(
//       "enhance",
//       `OpenAI API call failed: ${(err as Error).message}`,
//       err,
//     );
//   }

//   const content = response.choices[0]?.message?.content?.trim();
//   if (!content) {
//     throw new PipelineError("enhance", "Model returned empty content");
//   }

//   // Post-processing safety net for Title — strip newlines and trim
//   // anything past the first line if the model ignored the rule.
//   if (sectionType === "professional_title") {
//     return content.split("\n")[0].trim().replace(/^["']|["']$/g, "");
//   }

//   return content;
// };