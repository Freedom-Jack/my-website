export interface BlogPostPageContent {
  backButton: {
    text: string;
  };
  header: {
    dateFormat: {
      year: 'numeric' | '2-digit';
      month: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow';
      day: 'numeric' | '2-digit';
    };
  };
}

export const blogPostContent: BlogPostPageContent = {
  backButton: {
    text: "Back to All Blog Posts"
  },
  header: {
    dateFormat: {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }
  }
}; 