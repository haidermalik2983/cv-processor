"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { enhanceSingleSectionAction } from "@/app/actions/enhance-cv";
import {
  CV_HEADER,
  CV_SECTION_KEYS,
  type CVSectionKey,
  type CVSectionsMap,
  type CVSectionTitlesMap,
  MASTER_CV_SECTIONS,
  MASTER_CV_SECTION_TITLES,
} from "@/lib/cv-schema";
import { storage } from "@/lib/storage";
import { DEFAULT_PROMPT_TEMPLATE } from "@/lib/prompt-template";
import {
  MAX_EXPERIENCE_BULLETS,
  findOverflowingExperienceJobs,
} from "@/lib/experience-bullets";
import {
  MAX_PROJECT_BULLETS,
  findOverflowingProjects,
} from "@/lib/project-bullets";

const createBooleanMap = (value: boolean): Record<CVSectionKey, boolean> => ({
  headline: value,
  summary: value,
  workExperience: value,
  skills: value,
  education: value,
  projects: value,
});

const DISPLAY_SECTIONS: CVSectionKey[] = [
  "headline",
  "skills",
  "workExperience",
  "education",
  "projects",
];

const DOCX_SECTION_HEADINGS: Record<CVSectionKey, string | null> = {
  headline: null,
  summary: null,
  skills: "SKILLS",
  workExperience: "EXPERIENCE",
  education: "EDUCATION",
  projects: "PROJECTS",
};

type InputTab = "jobDescription" | "promptTemplate";

export default function Home() {
  const [jobDescription, setJobDescription] = useState("");
  const [promptTemplate, setPromptTemplate] = useState(DEFAULT_PROMPT_TEMPLATE);
  const [sections, setSections] = useState<CVSectionsMap>(MASTER_CV_SECTIONS);
  const [sectionTitles, setSectionTitles] = useState<CVSectionTitlesMap>(MASTER_CV_SECTION_TITLES);
  const [sectionLoading, setSectionLoading] = useState<Record<CVSectionKey, boolean>>(
    createBooleanMap(false),
  );
  const [activeInputTab, setActiveInputTab] = useState<InputTab>("jobDescription");
  const [activeEditSection, setActiveEditSection] = useState<CVSectionKey | null>(null);
  const [modalTitleDraft, setModalTitleDraft] = useState("");
  const [modalContentDraft, setModalContentDraft] = useState("");
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptModalDraft, setPromptModalDraft] = useState("");
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [cvHeader, setCvHeader] = useState(CV_HEADER);
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);
  const [headerDraft, setHeaderDraft] = useState(CV_HEADER);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setJobDescription(storage.loadJobDescription());
      setPromptTemplate(storage.loadPromptTemplate());
      setSections(storage.loadSections());
      setSectionTitles(storage.loadSectionTitles());
      setCvHeader(storage.loadHeader(CV_HEADER));
      setHasHydratedStorage(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }
    storage.saveJobDescription(jobDescription);
  }, [jobDescription, hasHydratedStorage]);

  useEffect(() => {
    if (!hasHydratedStorage) {
      return;
    }
    storage.savePromptTemplate(promptTemplate);
  }, [promptTemplate, hasHydratedStorage]);

  const anyLoading = useMemo(
    () => CV_SECTION_KEYS.some((sectionKey) => sectionLoading[sectionKey]),
    [sectionLoading],
  );
  const anyEditing = activeEditSection !== null || isPromptModalOpen || isHeaderModalOpen;

  const setSectionLoadingState = (sectionKey: CVSectionKey, isLoading: boolean) => {
    setSectionLoading((prev) => ({
      ...prev,
      [sectionKey]: isLoading,
    }));
  };

  const handleOpenHeaderModal = () => {
    setHeaderDraft(cvHeader);
    setIsHeaderModalOpen(true);
  };

  const handleSaveHeaderModal = () => {
    const next = {
      ...headerDraft,
      fullName: headerDraft.fullName.trim(),
      email: headerDraft.email.trim(),
      linkedinUrl: headerDraft.linkedinUrl.trim(),
      githubUrl: headerDraft.githubUrl.trim(),
      title: headerDraft.title.trim(),
    };
    setCvHeader(next);
    storage.saveHeader(next);
    setIsHeaderModalOpen(false);
    toast.success("Header updated.");
  };

  const handleCloseHeaderModal = () => {
    setIsHeaderModalOpen(false);
  };

  const handleEnhanceCV = async () => {
    const trimmedJobDescription = jobDescription.trim();
    if (!trimmedJobDescription) {
      toast.error("Please paste a job description before enhancing.");
      return;
    }
    if (!promptTemplate.trim()) {
      toast.error("Prompt template cannot be empty.");
      return;
    }

    // Snapshot current values so parallel closures don't see stale state.
    const currentSections = { ...sections };
    const currentTitles = { ...sectionTitles };

    // Mark all sections as loading up front.
    for (const sectionKey of CV_SECTION_KEYS) {
      setSectionLoadingState(sectionKey, true);
    }

    const enhanceSection = async (sectionKey: CVSectionKey) => {
      try {
        const result = await enhanceSingleSectionAction({
          sectionKey,
          sectionName: currentTitles[sectionKey],
          sectionContent: currentSections[sectionKey],
          jobDescription: trimmedJobDescription,
          promptTemplate,
        });

        setSections((prev) => {
          const next = {
            ...prev,
            [result.sectionKey]: result.enhancedContent,
          };
          storage.saveSection(result.sectionKey, result.enhancedContent);
          return next;
        });

        if (sectionKey === "headline") {
          const headlineTitleResult = await enhanceSingleSectionAction({
            sectionKey,
            sectionName: "Professional Title",
            sectionContent: currentTitles.headline,
            jobDescription: trimmedJobDescription,
            promptTemplate,
          });

          const nextHeadlineTitle = headlineTitleResult.enhancedContent
            .split("\n")
            .map((line) => line.trim())
            .find(Boolean);
          if (nextHeadlineTitle) {
            setSectionTitles((prev) => {
              const next = {
                ...prev,
                headline: nextHeadlineTitle,
              };
              storage.saveSectionTitle("headline", nextHeadlineTitle);
              return next;
            });
          }
        }
      } catch (error: unknown) {
        const sectionLabel = currentTitles[sectionKey];
        const message =
          error instanceof Error && error.message
            ? error.message
            : `Failed to enhance ${sectionLabel}.`;
        toast.error(message);
      } finally {
        setSectionLoadingState(sectionKey, false);
      }
    };

    await Promise.allSettled(CV_SECTION_KEYS.map(enhanceSection));
  };

  const handleOpenEditModal = (sectionKey: CVSectionKey) => {
    if (sectionLoading[sectionKey]) {
      return;
    }
    setActiveEditSection(sectionKey);
    setModalTitleDraft(sectionTitles[sectionKey]);
    setModalContentDraft(sections[sectionKey]);
  };

  const handleSaveEditModal = () => {
    if (!activeEditSection) return;

    const nextTitle = modalTitleDraft.trim();
    const nextValue = modalContentDraft.trim();

    if (!nextTitle) {
      toast.error("Section title cannot be empty.");
      return;
    }
    if (!nextValue) {
      toast.error("Section content cannot be empty.");
      return;
    }

    if (activeEditSection === "workExperience") {
      const overflows = findOverflowingExperienceJobs(nextValue);
      if (overflows.length > 0) {
        const detail = overflows
          .map((job) => `${job.jobName} (found ${job.count})`)
          .join(", ");
        toast.error(
          `Each job can have at most ${MAX_EXPERIENCE_BULLETS} bullets. Trim: ${detail}.`,
        );
        return;
      }
    }

    if (activeEditSection === "projects") {
      const overflows = findOverflowingProjects(nextValue);
      if (overflows.length > 0) {
        const detail = overflows
          .map((project) => `${project.projectName} (found ${project.count})`)
          .join(", ");
        toast.error(
          `Each project can have at most ${MAX_PROJECT_BULLETS} bullets. Trim: ${detail}.`,
        );
        return;
      }
    }

    setSections((prev) => ({
      ...prev,
      [activeEditSection]: nextValue,
    }));
    setSectionTitles((prev) => ({
      ...prev,
      [activeEditSection]: nextTitle,
    }));
    storage.saveSection(activeEditSection, nextValue);
    storage.saveSectionTitle(activeEditSection, nextTitle);
    toast.success(`${nextTitle} updated.`);
    setActiveEditSection(null);
  };

  const handleCloseEditModal = () => {
    setActiveEditSection(null);
  };

  const handleResetSection = (sectionKey: CVSectionKey) => {
    storage.resetSection(sectionKey);
    setSections((prev) => ({
      ...prev,
      [sectionKey]: MASTER_CV_SECTIONS[sectionKey],
    }));
    setSectionTitles((prev) => ({
      ...prev,
      [sectionKey]: MASTER_CV_SECTION_TITLES[sectionKey],
    }));
    toast.success(`${MASTER_CV_SECTION_TITLES[sectionKey]} reset to hardcoded content.`);
  };

  const handleResetAll = () => {
    storage.resetAllSections();
    storage.clearJobDescription();
    storage.clearPromptTemplate();
    storage.clearHeader();
    setSections(MASTER_CV_SECTIONS);
    setSectionTitles(MASTER_CV_SECTION_TITLES);
    setJobDescription("");
    setPromptTemplate(DEFAULT_PROMPT_TEMPLATE);
    setCvHeader(CV_HEADER);
    setActiveEditSection(null);
    toast.success("All sections and job description were reset.");
  };

  const handleExportPdf = () => {
    if (typeof window === "undefined") return;
    const previousTitle = document.title;
    const sanitized = cvHeader.fullName
      .trim()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_");
    const safeName = sanitized || previousTitle;
    document.title = safeName;
    const restore = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const handleOpenPromptModal = () => {
    setPromptModalDraft(promptTemplate);
    setIsPromptModalOpen(true);
  };

  const handleClosePromptModal = () => {
    setIsPromptModalOpen(false);
  };

  const handleSavePromptModal = () => {
    const nextPrompt = promptModalDraft.trim();
    if (!nextPrompt) {
      toast.error("Prompt template cannot be empty.");
      return;
    }
    setPromptTemplate(nextPrompt);
    setIsPromptModalOpen(false);
    toast.success("Prompt template updated.");
  };

  const renderSection = (sectionKey: CVSectionKey) => {
    const isLoading = sectionLoading[sectionKey];
    const sectionTitle = DOCX_SECTION_HEADINGS[sectionKey] ?? sectionTitles[sectionKey];
    const shouldShowHeading = Boolean(sectionTitle);
    const sectionContent = sections[sectionKey];
    const normalizeBulletText = (value: string) =>
      value
        .replace(/^[\s\u00A0\u2022\u2023\u2043\u2219\u25E6\u25AA\u25AB\u25CF\u25CB\u25A0\u25B8\u25B9•◦▪▫●○■▶▷\-*–—]+/u, "")
        .trim();
    const renderBulletLine = (value: string, key: string) => {
      const text = normalizeBulletText(value);
      if (!text) return null;

      return (
        <div key={key} className="cv-bullet-row text-sm leading-6">
          <span className="cv-bullet-marker" aria-hidden="true">
            •
          </span>
          <span>{text}</span>
        </div>
      );
    };

    const splitByBlankLines = (value: string) =>
      value
        .trim()
        .split(/\n\s*\n/)
        .map((entry) => entry.split("\n").map((line) => line.trim()).filter(Boolean))
        .filter((entry) => entry.length > 0);

    const renderHighlights = (content: string) => {
      const items = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      return <div className="space-y-0">{items.map((item, index) => renderBulletLine(item, `${item}-${index}`))}</div>;
    };

    const renderSkills = (content: string) => {
      const groups = splitByBlankLines(content);

      return (
        <div className="technical-skills-groups cv-entry-list">
          {groups.map((group, index) => {
            const [heading, ...items] = group;
            const normalizedItems = items
              .map((item) => normalizeBulletText(item))
              .filter(Boolean);
            const skillsLine = normalizedItems.join(", ");

            return (
              <div key={`${heading}-${index}`} className="cv-entry space-y-0">
                <p className="cv-skills-block text-sm">
                  <strong className="cv-skills-heading">{heading}</strong>
                  {skillsLine ? (
                    <>
                      <br />
                      <span>{skillsLine}</span>
                    </>
                  ) : null}
                </p>
              </div>
            );
          })}
        </div>
      );
    };

    const renderExperience = (content: string) => {
      const entries = splitByBlankLines(content);

      return (
        <div className="cv-entry-list cv-experience-list">
          {entries.map((entry, index) => {
            const [headerLine = "", roleLine = "", ...bullets] = entry;
            const [companyWithLocation = headerLine, dateRange = ""] = headerLine.split(" — ");
            const [companyName = companyWithLocation, ...locationParts] = companyWithLocation.split(",");
            const location = locationParts.join(",").trim();
            const displayRole = roleLine || companyName.trim();
            const displayCompany = roleLine ? companyName.trim() : "";
            const normalizedLines = bullets.map((line) => line.trim()).filter(Boolean);
            const technologiesLineIndex = normalizedLines.findIndex((line) =>
              /^technologies\s*:?/i.test(normalizeBulletText(line)),
            );
            const technologiesLine =
              technologiesLineIndex >= 0
                ? normalizeBulletText(normalizedLines[technologiesLineIndex])
                : "";
            const bulletLines = normalizedLines.filter(
              (_, lineIndex) => lineIndex !== technologiesLineIndex,
            );
            const techSeparatorIndex = technologiesLine.indexOf(":");
            const parsedTechLabel =
              techSeparatorIndex >= 0
                ? technologiesLine.slice(0, techSeparatorIndex).trim()
                : technologiesLine;
            const techLabel = parsedTechLabel || "Technologies";
            const techValue =
              techSeparatorIndex >= 0
                ? technologiesLine.slice(techSeparatorIndex + 1).trim()
                : "";

            return (
              <div key={`${companyWithLocation}-${index}`} className="cv-entry space-y-0">
                <div className="cv-exp-header">
                  <p className="cv-exp-role text-sm font-semibold">{displayRole}</p>
                  {(displayCompany || dateRange) && (
                    <p className="cv-exp-meta text-sm">
                      {displayCompany ? <span className="cv-exp-company">{displayCompany}</span> : null}
                      {location ? (
                        <>
                          {displayCompany ? <span className="cv-exp-sep"> - </span> : null}
                          <span className="cv-exp-location">{location}</span>
                        </>
                      ) : null}
                      {dateRange ? (
                        <>
                          {(displayCompany || location) ? <span className="cv-exp-sep"> | </span> : null}
                          <span className="cv-exp-date">{dateRange}</span>
                        </>
                      ) : null}
                    </p>
                  )}
                </div>
                {technologiesLine ? (
                  <p className="cv-exp-tech text-sm">
                    <span className="cv-exp-tech-label">{techLabel}</span>
                    {techValue ? <span className="cv-exp-tech-value">: {techValue}</span> : null}
                  </p>
                ) : null}
                <div className="space-y-0 cv-exp-bullets">
                  {bulletLines.map((bullet, bulletIndex) => {
                    const text = normalizeBulletText(bullet);
                    if (!text) return null;
                    return (
                      <div key={`${bullet}-${index}-${bulletIndex}`} className="cv-exp-bullet-row text-sm">
                        <span className="cv-exp-bullet-marker" aria-hidden="true">
                          •
                        </span>
                        <span>{text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    const renderEducation = (content: string) => {
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const [headerLine = "", degreeLine = ""] = lines;
      const [institutionWithLocation = headerLine, dateRange = ""] = headerLine.split(" — ");
      const [institutionName = institutionWithLocation, ...locationParts] =
        institutionWithLocation.split(",");
      const location = locationParts.join(",").trim();
      const displayDegree = degreeLine || institutionName.trim();
      const displayInstitution = degreeLine ? institutionName.trim() : "";

      return (
        <div className="space-y-0 cv-education-block">
          <p className="cv-edu-degree text-sm font-semibold">{displayDegree}</p>
          {(displayInstitution || dateRange) && (
            <p className="cv-edu-meta text-sm">
              {displayInstitution ? <span className="cv-edu-institution">{displayInstitution}</span> : null}
              {location ? (
                <>
                  {displayInstitution ? <span className="cv-edu-sep"> - </span> : null}
                  <span className="cv-edu-location">{location}</span>
                </>
              ) : null}
              {dateRange ? (
                <>
                  {(displayInstitution || location) ? <span className="cv-edu-sep"> | </span> : null}
                  <span className="cv-edu-date">{dateRange}</span>
                </>
              ) : null}
            </p>
          )}
        </div>
      );
    };

    const renderProjects = (content: string) => {
      const entries = splitByBlankLines(content);

      return (
        <div className="cv-entry-list cv-projects-list [&>*:not(:first-child)]:!mt-4">
          {entries.map((entry, index) => {
            const [titleLine = "", urlLine = "", stackLine = "", ...bullets] = entry;
            const isValidUrl = /^https?:\/\//.test(urlLine);
            const stackPrefix = "Tech Stack:";
            const hasStackPrefix = stackLine.startsWith(stackPrefix);
            const stackBody = hasStackPrefix
              ? stackLine.slice(stackPrefix.length).trim()
              : stackLine;

            return (
              <div key={`${titleLine}-${index}`} className="cv-entry space-y-0">
                <p className="cv-project-title text-sm font-semibold">{titleLine}</p>
                {isValidUrl ? (
                  <a
                    href={urlLine}
                    target="_blank"
                    rel="noreferrer"
                    className="cv-project-link text-sm"
                  >
                    {urlLine}
                  </a>
                ) : (
                  <p className="cv-project-link text-sm">{urlLine}</p>
                )}
                <p className="!mt-3 cv-project-tech text-sm">
                  <strong className="cv-project-tech-label">{stackPrefix}</strong>{" "}
                  <span className="cv-project-tech-value">{stackBody}</span>
                </p>
                <div className="space-y-0 cv-project-bullets">
                  {bullets.map((bullet, bulletIndex) => {
                    const text = normalizeBulletText(bullet);
                    if (!text) return null;
                    return (
                      <div key={`${bullet}-${index}-${bulletIndex}`} className="cv-project-bullet-row text-sm">
                        <span className="cv-project-bullet-marker" aria-hidden="true">
                          •
                        </span>
                        <span>{text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    const renderSectionBody = () => {
      if (sectionKey === "summary") return renderHighlights(sectionContent);
      if (sectionKey === "skills") return renderSkills(sectionContent);
      if (sectionKey === "workExperience") return renderExperience(sectionContent);
      if (sectionKey === "education") return renderEducation(sectionContent);
      if (sectionKey === "projects") return renderProjects(sectionContent);
      return <p className="whitespace-pre-line text-sm leading-6">{sectionContent}</p>;
    };

    return (
      <article
        key={sectionKey}
        className="cv-section"
      >
        {shouldShowHeading ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900 pb-1">
            <h2 className="text-base font-bold tracking-wide">{sectionTitle}</h2>
            <div className="flex items-center gap-2 print:hidden">
              {isLoading && (
                <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                  Enhancing...
                </span>
              )}
              <button
                type="button"
                onClick={() => handleOpenEditModal(sectionKey)}
                className="cv-section-action-button rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100"
                disabled={isLoading}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleResetSection(sectionKey)}
                className="cv-section-action-button rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100"
                disabled={isLoading}
              >
                Reset
              </button>
            </div>
          </div>
        ) : (
          <div className="mb-2 flex items-center justify-end gap-2 print:hidden">
            {isLoading && (
              <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                Enhancing...
              </span>
            )}
            <button
              type="button"
              onClick={() => handleOpenEditModal(sectionKey)}
              className="cv-section-action-button rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100"
              disabled={isLoading}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => handleResetSection(sectionKey)}
              className="cv-section-action-button rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100"
              disabled={isLoading}
            >
              Reset
            </button>
          </div>
        )}

        {renderSectionBody()}
      </article>
    );
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl bg-zinc-50 p-4 text-zinc-900 md:p-8 print:bg-white print:p-0">
      <main className="rounded-xl bg-white p-4 shadow-sm md:p-8 print:rounded-none print:shadow-none">
        <section className="mb-6 space-y-3 print:hidden">
          <h1 className="text-2xl font-semibold">CV Processor</h1>
          <p className="text-sm text-zinc-600">
            Paste a job description, enhance each CV section with AI, then press Ctrl+P to
            export as PDF.
          </p>
        </section>

        <section className="mb-8 print:hidden">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveInputTab("jobDescription")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeInputTab === "jobDescription"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Job Description
            </button>
            <button
              type="button"
              onClick={() => setActiveInputTab("promptTemplate")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activeInputTab === "promptTemplate"
                  ? "bg-zinc-900 text-white"
                  : "border border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              Prompt Template
            </button>
          </div>

          {activeInputTab === "jobDescription" ? (
            <>
              <label htmlFor="jobDescription" className="mb-2 block text-sm font-medium">
                Job Description
              </label>
              <textarea
                id="jobDescription"
                className="min-h-44 w-full rounded-lg border border-zinc-300 p-3 text-sm focus:border-zinc-500 focus:outline-none"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
                placeholder="Paste the job description here..."
              />
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="promptTemplate" className="block text-sm font-medium">
                  Prompt Template Sent to AI
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenPromptModal}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100"
                    disabled={anyLoading}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptTemplate(DEFAULT_PROMPT_TEMPLATE)}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100"
                    disabled={anyLoading}
                  >
                    Reset Prompt
                  </button>
                </div>
              </div>
              <textarea
                id="promptTemplate"
                className="min-h-52 w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs leading-5 focus:border-zinc-500 focus:outline-none"
                value={promptTemplate}
                readOnly
                placeholder="Customize the enhancement prompt template..."
              />
              <p className="mt-2 text-xs text-zinc-500">
                Click Edit to update the prompt.
              </p>
            </>
          )}

          <div className="mt-3">
            <button
              type="button"
              onClick={handleEnhanceCV}
              disabled={anyLoading || anyEditing}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {anyLoading ? "Enhancing..." : "Enhance CV"}
            </button>
            <button
              type="button"
              onClick={handleResetAll}
              disabled={anyLoading}
              className="ml-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset All
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={anyLoading || anyEditing}
              className="ml-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Export PDF
            </button>
          </div>
          {anyEditing && (
            <p className="mt-2 text-xs text-zinc-500">
              Close the section edit modal before enhancing.
            </p>
          )}
        </section>

        <div className="cv-content">
          <header className="cv-header mb-6 print:mb-4">
            <div className="relative flex items-center justify-center">
              <h2 className="text-center text-4xl font-bold tracking-wide text-zinc-900">
                {cvHeader.fullName}
              </h2>
              <button
                type="button"
                onClick={handleOpenHeaderModal}
                className="absolute right-0 rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-100 print:hidden"
              >
                Edit
              </button>
            </div>
            <p className="mt-1 text-center text-sm text-zinc-700">
              {cvHeader.contactLine}
              <a href={`mailto:${cvHeader.email}`} className="underline text-blue-600">
                {cvHeader.email}
              </a>
              {cvHeader.contactSeparator}
              <a
                href={cvHeader.linkedinUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline text-blue-600"
              >
                {cvHeader.linkedinUrl.replace("https://", "")}
              </a>
              {cvHeader.githubSeparator}
              <a
                href={cvHeader.githubUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="underline text-blue-600"
              >
                {cvHeader.githubUrl.replace("https://", "")}
              </a>
            </p>
          </header>

          <section className="space-y-5 print:space-y-5">
            {DISPLAY_SECTIONS.map(renderSection)}
          </section>
        </div>
      </main>

      {activeEditSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Edit Section</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Update both section title and content.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="modalSectionTitle" className="mb-1 block text-sm font-medium">
                  Section Title
                </label>
                <input
                  id="modalSectionTitle"
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  value={modalTitleDraft}
                  onChange={(event) => setModalTitleDraft(event.target.value)}
                />
              </div>

              <div>
                <label htmlFor="modalSectionContent" className="mb-1 block text-sm font-medium">
                  Section Content
                </label>
                <textarea
                  id="modalSectionContent"
                  className="min-h-52 w-full rounded-lg border border-zinc-300 p-3 text-sm focus:border-zinc-500 focus:outline-none"
                  value={modalContentDraft}
                  onChange={(event) => setModalContentDraft(event.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseEditModal}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditModal}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {isHeaderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Edit Header</h3>
            <div className="mt-4 space-y-3">
              {(
                [
                  { label: "Full Name", field: "fullName" },
                  { label: "Email", field: "email" },
                  { label: "LinkedIn URL", field: "linkedinUrl" },
                  { label: "GitHub URL", field: "githubUrl" },
                  { label: "Title", field: "title" },
                ] as const
              ).map(({ label, field }) => (
                <div key={field}>
                  <label className="mb-1 block text-sm font-medium">{label}</label>
                  <input
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                    value={headerDraft[field]}
                    onChange={(e) => setHeaderDraft((prev) => ({ ...prev, [field]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseHeaderModal}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHeaderModal}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {isPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 print:hidden">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Edit Prompt Template</h3>
            <p className="mt-1 text-sm text-zinc-600">
              Update prompt content used for all section enhancement requests.
            </p>

            <div className="mt-4">
              <textarea
                className="min-h-72 w-full rounded-lg border border-zinc-300 p-3 font-mono text-xs leading-5 focus:border-zinc-500 focus:outline-none"
                value={promptModalDraft}
                onChange={(event) => setPromptModalDraft(event.target.value)}
              />
            </div>

            <p className="mt-2 text-xs text-zinc-500">
              Keep this focused on instructions. Context fields are added automatically.
            </p>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClosePromptModal}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePromptModal}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
