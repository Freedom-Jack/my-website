export interface AboutPageContent {
  header: {
    title: string;
    subtitle: string;
    description: string;
  };
  sections: {
    bio: {
      title: string;
      content: string[];
    };
    skills: {
      title: string;
      categories: {
        title: string;
        items: string[];
      }[];
    };
    experience: {
      title: string;
      items: {
        company: string;
        roles: {
          title: string;
          startDate: string;
          endDate: string;
          isCurrent: boolean;
          description: string[];
        }[];
      }[];
    };
    education: {
      title: string;
      items: {
        degree: string;
        institution: string;
        startDate: string;
        endDate: string;
        description: string[];
      }[];
    };
  };
}

export const aboutContent: AboutPageContent = {
  header: {
    title: "About Me",
    subtitle: "Engineering Scalable and Intelligent Systems",
    description: "I'm Qijin Xu, a software engineer and data architect passionate about building robust, intelligent systems. With experience spanning cloud platforms, ML pipelines, and full-stack development, I bridge engineering excellence and business impact."
  },
  sections: {
    bio: {
      title: "Bio",
      content: [
        "Based in Toronto, I specialize in designing distributed systems, AI solutions, and cloud infrastructure. I'm currently a Senior Consultant at CGI, leading high-impact data and AI initiatives.",
        "With a Computer Science degree from York University and certifications like Azure Solutions Architect Expert and PMP, I bring both technical depth and project leadership to the table.",
        "Outside of work, I enjoy diving into new technologies, mentoring, and contributing to open-source projects."
      ]
    },
    skills: {
      title: "Skills",
      categories: [
        {
          title: "Desgin & Architecture",
          items: ["Microservices", "Distributed Systems", "Event-driven Architecture"]
        },
        {
          title: "Programming Languages",
          items: ["Python", "Go", "Java", "C", "C#"]
        },
        {
          title: "Databases & Big Data",
          items: ["MySQL", "PostgreSQL", "SQL Server", "Kafka", "Apache Spark", "MapReduce", "Hive", "BigQuery"]
        },
        {
          title: "Machine Learning",
          items: ["PyTorch", "TensorFlow"]
        },
        {
          title: "DevOps & Cloud",
          items: ["Docker", "Kubernetes", "Jenkins", "Azure Pipelines", "GitHub Actions", "Azure", "AWS", "GCP"]
        },
        {
          title: "Infrastructure as Code",
          items: ["Terraform", "Bicep", "Azure Resource Manager", "AWS CloudFormation"]
        }
      ]
    },
    experience: {
      title: "Experience",
      items: [
        {
          company: "CGI",
          roles: [
            {
              title: "Lead DE & SDE, Senior Consultant",
              startDate: "Jan 2025",
              endDate: "Present",
              isCurrent: true,
              description: [
                "Leading enterprise cloud and AI engineering initiatives to drive transformation in the insurance sector."
              ]
            },
            {
              title: "Lead DE & SDE, Consultant",
              startDate: "Aug 2023",
              endDate: "Dec 2024",
              isCurrent: false,
              description: [
                "Designed and developed a Retrieval-Augmented Generation (RAG) chatbot using Azure and AWS.",
                "Delivered 525% ROI by automating customer service across multiple languages and regions."
              ]
            },
            {
              title: "Data Engineer, Consultant",
              startDate: "Aug 2021",
              endDate: "Jul 2023",
              isCurrent: false,
              description: [
                "Managed Canada's largest automobile insurance databases and designed over 22 systems for finance and reporting.",
                "Built a machine learning-based loss ratio score that improved fraud detection accuracy by 321%."
              ]
            }
          ]
        },
        {
          company: "Elder Laboratory, York University",
          roles: [
            {
              title: "Research Assistant",
              startDate: "Nov 2018",
              endDate: "Aug 2021",
              isCurrent: false,
              description: [
                "Built ML pipelines for sports video analysis using PyTorch and TensorFlow.",
                "Developed automated event detection and real-time tracking systems for hockey performance analysis."
              ]
            }
          ]
        },
        {
          company: "Nascent Digital",
          roles: [
            {
              title: "Full-Stack Developer Intern",
              startDate: "May 2019",
              endDate: "Aug 2019",
              isCurrent: false,
              description: [
                "Implemented end-to-end features with React and TypeScript, and led the redesign of the company homepage.",
                "Launched Telus product pages and built a visual regression testing framework to streamline QA."
              ]
            }
          ]
        }
      ]
    },
    education: {
      title: "Education",
      items: [
        {
          degree: "B.Sc in Computer Science (Specialized Honours)",
          institution: "York University, Toronto",
          startDate: "2017",
          endDate: "2020",
          description: ["Graduated with GPA: 3.9/4.0", "First Class with Distinction"]
        }
      ]
    }
  }
};
