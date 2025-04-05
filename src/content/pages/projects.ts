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
    viewAll: string;
  };
}

export const projectsContent: ProjectsPageContent = {
  header: {
    title: "My Projects",
    description: "A showcase of my work in machine learning, data analysis, and software development."
  },
  stats: {
    title: "GitHub Statistics",
    description: "Live statistics from my GitHub profile."
  },
  projects: {
    title: "Featured Projects",
    viewAll: "View All Projects on GitHub"
  }
}; 