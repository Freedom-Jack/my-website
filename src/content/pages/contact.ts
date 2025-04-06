export interface ContactPageContent {
  header: {
    title: string;
    description: string;
  };
  buttons: {
    email: string;
    resume: string;
  };
}

export const contactContent: ContactPageContent = {
  header: {
    title: "Contact Me",
    description: "I'm always open to discussing new projects, opportunities, or collaborations. Feel free to reach out through any of the channels below."
  },
  buttons: {
    email: "Send Email",
    resume: "Download Resume"
  }
}; 