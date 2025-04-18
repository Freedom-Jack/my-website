export interface HomePageContent {
  hero: {
    title: string;
    subtitle: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  };
  about: {
    tag: string;
    title: string;
    description: string;
    cta: string;
    profile: {
      name: string;
      role: string;
    };
  };
}


const START_YEAR = 2021;         //  My start year
export const yearsOfExperience = new Date().getFullYear() - START_YEAR;


export const homeContent: HomePageContent = {
  hero: {
    title: "Qijin Xu",
    subtitle: "Software Development Engineer",
    description: "Specializing in Machine Learning & AI | Data Engineering",
    primaryCta: "View My Projects",
    secondaryCta: "Learn More About Me"
  },
  about: {
    tag: "Professional Profile",
    title: "Software Engineer — AI & Data at Scale",
    description: "I’m a Software Development Engineer blending AI research with production‑scale data. \
    At CGI I direct pipelines behind Canada’s largest auto‑insurance database while shipping live AI, \
    including a RAG chatbot and workflow agent. \
    From T‑SQL to full‑stack ML, I turn terabytes into smart, \
    deployable solutions that move business needles—poised to deliver at FAANG scale.",
    cta: "Explore My Background",
    profile: {
      name: "Qijin Xu",
      role: "Software Development Engineer"
    }
  }
}; 