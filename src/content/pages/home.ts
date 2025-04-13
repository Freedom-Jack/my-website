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

export const homeContent: HomePageContent = {
  hero: {
    title: "Qijin Xu",
    subtitle: "Senior Software Engineer",
    description: "Specializing in Machine Learning & AI | Cloud Architecture | Full-Stack Development",
    primaryCta: "View My Projects",
    secondaryCta: "Learn More About Me"
  },
  about: {
    tag: "Professional Profile",
    title: "Driving Innovation Through Technology",
    description: "I am a results-driven Software Engineer with expertise in machine learning, artificial intelligence, and cloud computing. With experience at leading tech companies and a strong academic background, I excel at developing scalable solutions and implementing cutting-edge technologies to solve complex problems.",
    cta: "Explore My Background",
    profile: {
      name: "Qijin Xu",
      role: "Senior Software Engineer"
    }
  }
}; 