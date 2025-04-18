export interface AboutPageContent {
  header: {
    title: string;
    subtitle: string;
    description: string;
  };
  sections: {
    bio: {
      title: string;
      content: {
        heading: string;
        text: string;
      }[];
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
          keywords: string[];
          description: string[];
          highlightPatterns: {
            pattern: string;
          }[];
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
    certificates: {
      title: string;
      items: {
        name: string;
        issuer: string;
        date: string;
        credentialId?: string;
      }[];
    };
  };
}

export const aboutContent: AboutPageContent = {
  header: {
    title: "About Me",
    subtitle: "Engineering AI & Data Systems at Scale",
    description: "I'm Qijin Xu, also go by Jack, an AI‑driven software engineer and data architect based in Toronto. I build production‑grade systems that fuse massive data pipelines with cutting‑edge machine‑learning models — turning raw information into real‑time intelligence and business impact."
  },
  sections: {
    bio: {
      title: "Bio",
      content: [
        {
          heading: "Current Role",
          text: "As a Senior Consultant at CGI, I lead enterprise AI initiatives and steward Canada's largest auto‑insurance database. Recent wins include launching a Retrieval‑Augmented‑Generation chatbot and an autonomous workflow agent that streamline claims operations company‑wide."
        },
        {
          heading: "Expertise & Stack",
          text: "Python, TypeScript, T‑SQL, Azure, Databricks, LangChain — end‑to‑end ownership from data ingestion to full‑stack ML services."
        },
        {
          heading: "Credentials",
          text: "B.Sc. in Computer Science, York University · Microsoft Certified: Azure Solutions Architect Expert · Project Management Professional (PMP)."
        },
        {
          heading: "Beyond Code",
          text: "Open‑source contributor, I am a big video gamer and I love to build game assistant tools."
        }
      ]
    },
    skills: {
      title: "Skills",
      categories: [
        {
          title: "AI & LLM Engineering",
          items: [
            "Large Language Models (LLMs)",
            "Retrieval‑Augmented Generation (RAG)",
            "Transformers & Attention",
            "LangChain / HuggingFace / OpenAI SDKs",
            "Prompt & Chain‑of‑Thought Engineering",
            "LoRA / PEFT Fine‑Tuning"
          ]
        },
        {
          title: "Backend & System Design",
          items: [
            "Distributed Systems & Scalability",
            "Microservices & Service Mesh",
            "API Design (REST / GraphQL)",
            "Database Design (SQL & NoSQL)",
            "Event‑Driven Architecture & CQRS",
            "Message Queues (Kafka, RabbitMQ)"
          ]
        },
        {
          title: "Cloud & DevOps",
          items: [
            "Docker & Kubernetes",
            "AWS (EKS, Lambda, S3, ECS)",
            "Azure Functions & AKS",
            "Terraform & IaC",
            "CI/CD (GitHub Actions, Azure DevOps)",
            "Observability (CloudWatch, Prometheus)"
          ]
        },
        {
          title: "Programming Languages",
          items: [
            "Python",
            "Go",
            "TypeScript / Node.js",
            "Java",
            "T‑SQL & PL/pgSQL",
            "Bash / Shell Scripting"
          ]
        },
        {
          title: "Data & ML Infrastructure",
          items: [
            "Vector Stores (Pinecone, Weaviate)",
            "Embedding Models (OpenAI, Cohere)",
            "ML Pipelines (Airflow, MLflow)",
            "Data Warehousing (BigQuery, Snowflake)",
            "Databricks & Delta Lake",
            "Feature Stores (Feast)"
          ]
        },
        {
          title: "Full‑Stack Development",
          items: [
            "React / Next.js",
            "tRPC & GraphQL",
            "Tailwind CSS",
            "Vercel & Edge Functions",
            "Auth0 & OAuth2",
            "Testing (Jest, Playwright)"
          ]
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
              title: "Lead Data Engineer & Software Development Engineer, Senior Consultant",
              startDate: "Jan 2025",
              endDate: "Present",
              isCurrent: true,
              keywords: ["Cloud Architecture", "AI Engineering", "Insurance Tech", "Team Leadership"],
              description: [
                "Leading enterprise cloud and AI engineering initiatives to drive transformation in the insurance sector."
              ],
              highlightPatterns: [
                { pattern: "cloud" },
                { pattern: "AI" },
                { pattern: "insurance" }
              ]
            },
            {
              title: "Lead Data Engineer & Software Development Engineer, Consultant",
              startDate: "Aug 2023",
              endDate: "Dec 2024",
              isCurrent: false,
              keywords: ["RAG", "Azure", "AWS", "Multi-language Support", "Automation"],
              description: [
                "Designed and developed a Retrieval-Augmented Generation (RAG) chatbot using Azure and AWS.",
                "Delivered 525% ROI by automating customer service across multiple languages and regions."
              ],
              highlightPatterns: [
                { pattern: "RAG" },
                { pattern: "Azure|AWS" },
                { pattern: "ROI" },
                { pattern: "automating" }
              ]
            },
            {
              title: "Data Engineer, Consultant",
              startDate: "Aug 2021",
              endDate: "Jul 2023",
              isCurrent: false,
              keywords: ["Big Data", "Machine Learning", "Fraud Detection", "System Design"],
              description: [
                "Managed Canada's largest automobile insurance databases and designed over 22 systems for finance and reporting.",
                "Built a machine learning-based loss ratio score that improved fraud detection accuracy by 321%."
              ],
              highlightPatterns: [
                { pattern: "databases" },
                { pattern: "machine learning" },
                { pattern: "fraud detection" },
                { pattern: "321%" }
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
              keywords: ["Computer Vision", "ML Pipelines", "Sports Analytics", "Real-time Systems"],
              description: [
                "Built ML pipelines for sports video analysis using PyTorch and TensorFlow.",
                "Developed automated event detection and real-time tracking systems for hockey performance analysis."
              ],
              highlightPatterns: [
                { pattern: "ML pipelines" },
                { pattern: "PyTorch|TensorFlow" },
                { pattern: "real-time" },
                { pattern: "automated" }
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
              keywords: ["React", "TypeScript", "Frontend Development", "QA Automation"],
              description: [
                "Implemented end-to-end features with React and TypeScript, and led the redesign of the company homepage.",
                "Launched Telus product pages and built a visual regression testing framework to streamline QA."
              ],
              highlightPatterns: [
                { pattern: "React|TypeScript" },
                { pattern: "end-to-end" },
                { pattern: "QA" }
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
          endDate: "2021",
          description: ["Graduated with GPA: 3.9/4.0", "First Class with Distinction"]
        }
      ]
    },
    certificates: {
      title: "Certifications",
      items: [
        {
          name: "Microsoft Certified: Azure Administrator Associate",
          issuer: "Microsoft",
          date: "2023",
          credentialId: "1234567890"
        },
        {
          name: "Project Management Professional (PMP)",
          issuer: "Project Management Institute",
          date: "2022",
          credentialId: "0987654321"
        }
      ]
    }
  }
};
