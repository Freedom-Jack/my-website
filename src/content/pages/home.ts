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
    title: "Full-Stack Developer\nBuilding Modern Web Experiences",
    description: "Passionate about creating performant, scalable applications with cutting-edge technologies. Focused on delivering exceptional user experiences.",
    cta: {
      primary: "View My Projects",
      secondary: "Explore More"
    }
  },
  about: {
    tag: "About Me",
    title: "Software Engineer with a Passion for Innovation",
    description: "I specialize in building modern web applications with React, TypeScript, and Node.js. My experience includes working with cloud infrastructure, CI/CD pipelines, and developing scalable software solutions.",
    cta: "Learn More",
    profile: {
      name: "Your Name",
      role: "Full-Stack Developer"
    }
  },
  map: {
    title: "Global Experience",
    description: "Interactive map showcasing countries I've worked with or visited. Hover over highlighted countries to learn more."
  }
}; 