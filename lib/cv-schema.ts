export const CV_SECTION_KEYS = [
  "headline",
  "summary",
  "workExperience",
  "skills",
  "education",
  "projects",
] as const;

export type CVSectionKey = (typeof CV_SECTION_KEYS)[number];

export type CVSectionsMap = Record<CVSectionKey, string>;
export type CVSectionTitlesMap = Record<CVSectionKey, string>;

export const CV_SECTION_LABELS: Record<CVSectionKey, string> = {
  headline: "Senior Full-Stack Developer | Node.js / React.js",
  summary: "KEY HIGHLIGHTS",
  workExperience: "EXPERIENCE",
  skills: "SKILLS",
  education: "EDUCATION",
  projects: "PROJECTS",
};

export const MASTER_CV_SECTION_TITLES: CVSectionTitlesMap = { ...CV_SECTION_LABELS };

export const CV_HEADER = {
  fullName: "HAIDER MALIK",
  contactLine: "Email: ",
  email: "",
  linkedinUrl: "https://pk.linkedin.com/in/haidermalik2983",
  contactSeparator: " - LinkedIn: ",
  githubSeparator: " - GitHub: ",
  githubUrl: "https://github.com/haidermalik2983",
  title: CV_SECTION_LABELS.headline,
};

export const MASTER_CV_SECTIONS: CVSectionsMap = {
  headline:
    "Senior Full-Stack Developer (Node.js / React.js)",
  summary:
    "Full-Stack MERN Developer with 5+ years of experience building scalable web applications\nusing MongoDB, Express.js, React, Node.js, and NestJS. Strong in designing secure REST APIs,\noptimizing databases, and delivering high-performance frontend and backend systems.\nExperienced in leading development, working with cross-functional teams, and shipping\nproduction-ready applications using modern cloud and DevOps workflows.",
  workExperience:
    "Upwork, Remote\nSenior Full Stack Developer | Freelancer & Consultant\nPresent\n● Built scalable REST APIs and optimized database queries to support growing traffic and data.\n● Set up CI/CD pipelines with GitHub Actions and test-driven workflows, reducing manual work by 60% and speeding up releases by 30%.\n● Developed clean, responsive UIs with React.js, data visualizations, and smooth animations, increasing user engagement by 40%.\n● Worked closely with product and design teams to ship production-ready features from start to finish.\n\nCelestials Technologies, Pakistan\nFull-Stack Developer | Node.js/Nest.js\nMar 2023 – Dec 2025\n● Led full-stack development using MongoDB, Express, React, Node.js, and Nest.js.\n● Built scalable REST APIs and backend services used by multiple client apps.\n● Designed database schemas and optimized queries to improve response time by 30%.\n● Developed reusable React components and hooks to speed up feature delivery.\n\nDatalatics, Pakistan\nFullstack Developer\nSep 2021 – Feb 2023\n● Built backend services using Express.js, Nest.js, Node.js, and MongoDB.\n● Designed and maintained RESTful APIs for web applications.\n● Implemented authentication, authorization, and data validation layers.\n● Optimized database queries and indexes to reduce API latency.",
  skills:
    "● Javascript\n● TypeScript\n● Node.js\n● Express.js\n● Nest.js\n● React.js / Next.js\n● Vue.js\n● Redux Toolkit / Zustand\n● React Query\n● Tailwind UI\n● Shadcn\n● Formik\n● Yup / Zod\n● Sequelize / Mongoose\n● TypeORM / Prisma\n● Jest / Playwright\n● React Testing Library\n● Postgres / Supabase\n● MySQL\n● MongoDB\n● CI/CD Pipelines\n● Docker\n● AWS\n● REST API / GraphQL",
  education:
    "University of Gujrat, Pakistan\n2017 – 2021\nBachelor of Science (BS), Software Engineering",
  projects:
    "YakuraApp, SaaS Marketplace\nhttps://www.yakuraapp.com/\nYakuraApp is a platform for discovering and buying premium SaaS tools. It helps businesses find trusted software fast and manage their purchases in one place.\n● Industries: SaaS, Software & Technology, Startups, Small and Medium Businesses, Enterprise Software, Productivity & Business Tools, Digital Services, B2B Platforms\n● Tech Stack: TypeScript, Next.js, Tailwind CSS, Rest APIs, CI/CD pipelines, MongoDB, and Node.js\n● Partnered with a specialized team of four experts including a designer, front-end developer, back-end developer, and DevOps engineer to deliver high-impact features and enhance platform performance.\n\nTravacado, Checklist Your Adventure\nhttps://travacado.com/\nTravacado helps travelers plan trips with smart packing checklists and curated guides. It makes outdoor adventures easier, organized, and stress-free.\n● Industries: Travel & Tourism, Outdoor & Adventure, Lifestyle & Recreation, Consumer Apps, Travel Planning, Sports & Camping.\n● Tech Stack: Next.js, Redux, Material UI, JavaScript, TypeScript, Supabase, Node js, Nest js, AWS, and SCSS\n● Collaborated with designers, backend engineers, and QA teams to deliver reliable real-time dashboards and testing workflows used by enterprise clients.\n\nInfinitequant, Trade smarter. Earn real rewards.\nhttps://www.infinitequant.app/\nA trading platform that lets users trade, track performance, and earn rewards in real time. Built for speed, transparency, and fair payouts using modern blockchain technology.\n● Industries: Fintech, Trading & Investments, Cryptocurrency, Blockchain, Financial Services, Web3 Platforms, Retail Trading\n● Tech Stack: Next.js, Redux, TypeScript, JavaScript, Restful APIs, Tailwind CSS, CSS 3\n● Designed the system to handle performance tracking of a large number of users efficiently while keeping responses clear and context-aware.",
};

