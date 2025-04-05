export interface ContactInfo {
  email: {
    address: string;
    display: string;
  };
  github: {
    url: string;
    username: string;
  };
  linkedin: {
    url: string;
    profile: string;
  };
}

export const contactInfo: ContactInfo = {
  email: {
    address: "qxjack@gmail.com",
    display: "qxjack@gmail.com"
  },
  github: {
    url: "https://github.com/Freedom-Jack",
    username: "Freedom-Jack"
  },
  linkedin: {
    url: "https://www.linkedin.com/in/qijin-x-4899671a9/",
    profile: "Qijin (Jack) Xu"
  }
}; 