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
  authorSection: {
    title: string;
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
  },
  authorSection: {
    title: "About the Author"
  }
}; 