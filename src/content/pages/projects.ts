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
    liveData: string;
  };
}

export const projectsContent: ProjectsPageContent = {
  header: {
    title: "My Projects",
    description: "A showcase of my work in machine learning, data analysis, and software development."
  },
  stats: {
    title: "GitHub Statistics",
    description: "Live statistics from my GitHub profile, showing my contributions and technical expertise in machine learning and AI development."
  },
  projects: {
    title: "Featured Projects",
    description: "Here are some of my most recent and notable projects, showcasing my expertise in machine learning algorithms, data analysis, and AI applications.",
    viewAll: "View All Projects on GitHub",
    liveData: "Data is fetched live from GitHub"
  }
}; 