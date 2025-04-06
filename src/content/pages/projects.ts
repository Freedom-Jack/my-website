import { GitHubRepo, GitHubUser } from '@/lib/github';

export interface ProjectsPageContent {
  header: {
    title: string;
    description: string;
  };
  stats: {
    title: string;
  };
  projects: {
    title: string;
    viewAll: string;
  };
}

export const projectsContent: ProjectsPageContent = {
  header: {
    title: "My Projects",
    description: "Real-time data from my GitHub profile"
  },
  stats: {
    title: "GitHub Statistics"
  },
  projects: {
    title: "Featured Projects",
    viewAll: "View All Projects on GitHub"
  }
}; 