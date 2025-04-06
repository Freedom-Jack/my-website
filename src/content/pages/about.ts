export interface AboutPageContent {
  header: {
    title: string;
    subtitle: string;
    description: string;
  };
  sections: {
    bio: {
      title: string;
      content: string[];
    };
    skills: {
      title: string;
      categories: {
        title: string;
        items: string[];
      }[];
    };
    experience: {
      title: string;
      items: {
        role: string;
        company: string;
        period: string;
        description: string[];
      }[];
    };
    education: {
      title: string;
      items: {
        degree: string;
        institution: string;
        period: string;
        description: string[];
      }[];
    };
  };
}

export const aboutContent: AboutPageContent = {
  header: {
    title: "About Me",
    subtitle: "Crafting Digital Experiences",
    description: "A passionate developer dedicated to creating elegant solutions to complex problems. With a keen eye for design and a love for clean code, I strive to build applications that are both beautiful and functional."
  },
  sections: {
    bio: {
      title: "Who Am I?",
      content: [
        "I'm a self-motivated developer with a strong passion for creating innovative digital solutions. My journey in technology began with a curiosity about how things work, which evolved into a deep love for software development.",
        "I believe in writing clean, maintainable code and following best practices to create scalable applications. My approach combines technical expertise with creative problem-solving to deliver exceptional user experiences.",
        "When I'm not coding, you can find me exploring new technologies, contributing to open-source projects, or sharing my knowledge with the developer community."
      ]
    },
    skills: {
      title: "Technical Expertise",
      categories: [
        {
          title: "Frontend Development",
          items: [
            "React.js",
            "Next.js",
            "TypeScript",
            "Tailwind CSS",
            "HTML5/CSS3",
            "Responsive Design"
          ]
        },
        {
          title: "Backend Development",
          items: [
            "Node.js",
            "Express",
            "RESTful APIs",
            "GraphQL",
            "Database Design",
            "Authentication"
          ]
        },
        {
          title: "Tools & Technologies",
          items: [
            "Git & GitHub",
            "Docker",
            "CI/CD",
            "Testing",
            "Cloud Services",
            "DevOps"
          ]
        }
      ]
    },
    experience: {
      title: "Professional Journey",
      items: [
        {
          role: "Senior Software Engineer",
          company: "Tech Innovations Inc.",
          period: "2020 - Present",
          description: [
            "Led the development of multiple high-traffic web applications",
            "Implemented modern development practices and CI/CD pipelines",
            "Mentored junior developers and conducted code reviews"
          ]
        },
        {
          role: "Software Developer",
          company: "Digital Solutions Ltd.",
          period: "2018 - 2020",
          description: [
            "Developed and maintained enterprise-level applications",
            "Collaborated with cross-functional teams on complex projects",
            "Optimized application performance and user experience"
          ]
        }
      ]
    },
    education: {
      title: "Academic Background",
      items: [
        {
          degree: "Master of Science in Computer Science",
          institution: "Tech University",
          period: "2016 - 2018",
          description: [
            "Specialized in Software Engineering",
            "Graduated with honors",
            "Published research on AI applications"
          ]
        },
        {
          degree: "Bachelor of Science in Computer Science",
          institution: "State University",
          period: "2012 - 2016",
          description: [
            "Major in Software Development",
            "Minor in Mathematics",
            "Dean's List recipient"
          ]
        }
      ]
    }
  }
}; 