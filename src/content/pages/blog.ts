export interface BlogPageContent {
  header: {
    title: string;
    subtitle: string;
    description: string;
  };
  sections: {
    recentPosts: {
      title: string;
    };
  };
}

export const blogContent: BlogPageContent = {
  header: {
    title: "Blog",
    subtitle: "Thoughts and Ideas",
    description: "Explore my writing on software development, AI, and technology insights."
  },
  sections: {
    recentPosts: {
      title: "Recent Posts"
    }
  }
}; 