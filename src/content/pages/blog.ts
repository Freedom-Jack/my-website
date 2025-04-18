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
  blogCard: {
    readMore: string;
    dateFormat: {
      year: 'numeric' | '2-digit';
      month: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
      day: 'numeric' | '2-digit';
    };
  };
  metadata: {
    defaultTitle: string;
    defaultDescription: string;
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
  },
  blogCard: {
    readMore: "Read more",
    dateFormat: {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  },
  metadata: {
    defaultTitle: "Blog",
    defaultDescription: "Read my latest thoughts and insights"
  }
}; 