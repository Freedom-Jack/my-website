import { GitHubRepo, GitHubUser } from '@/lib/github';

export interface ProjectsPageContent {
  header: {
    title: string;
    description: string;
  };
  stats: {
    title: string;
    description: string;
  };
  projects: {
    title: string;
    description: string;
    viewAll: string;
  };
}

export const projectsContent: ProjectsPageContent = {
  header: {
    title: "My Projects",
    description: "A collection of my work in algorithms, data analysis, and web development."
  },
  stats: {
    title: "GitHub Statistics",
    description: "Overview of my contributions and technical expertise."
  },
  projects: {
    title: "Featured Projects",
    description: "Here are some of my most recent and notable projects, showcasing my work in various programming languages and domains.",
    viewAll: "View All Projects on GitHub"
  }
}; 