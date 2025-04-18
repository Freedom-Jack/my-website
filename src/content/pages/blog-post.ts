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
  jsonLd: {
    schema: string;
    type: string;
    context: string;
    headline: string;
    datePublished: string;
    dateModified: string;
    description: string;
    author: string;
    personType: string;
    name: string;
    image: string;
    mainEntityOfPage: string;
    webPageType: string;
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
  },
  jsonLd: {
    schema: "application/ld+json",
    type: "BlogPosting",
    context: "https://schema.org",
    headline: "headline",
    datePublished: "datePublished",
    dateModified: "dateModified",
    description: "description",
    author: "author",
    personType: "Person",
    name: "name",
    image: "image",
    mainEntityOfPage: "mainEntityOfPage",
    webPageType: "WebPage"
  }
}; 