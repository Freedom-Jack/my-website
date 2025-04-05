export interface HomePageContent {
  hero: {
    title: string;
    description: string;
    cta: {
      primary: string;
      secondary: string;
    };
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
  map: {
    title: string;
    description: string;
  };
}

export const homeContent: HomePageContent = {
  hero: {
    title: "Software Development Engineer\nSpecializing in Machine Learning & AI",
    description: "Passionate about building intelligent systems with modern technologies. Experienced in machine learning, data engineering, and software development.",
    cta: {
      primary: "View My Projects",
      secondary: "Explore More"
    }
  },
  about: {
    tag: "About Me",
    title: "Software Development Engineer with ML Expertise",
    description: "I specialize in software development with a focus on machine learning and AI applications. My experience includes developing recommendation systems, implementing ML algorithms, and building data pipelines. I'm passionate about creating innovative solutions that leverage data to solve complex problems.",
    cta: "Learn More",
    profile: {
      name: "Qijin X",
      role: "Software Development Engineer"
    }
  },
  map: {
    title: "Global Experience",
    description: "Interactive map showcasing countries I've worked with or visited. Hover over highlighted countries to learn more."
  }
}; 