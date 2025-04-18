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
          description?: string[];
          highlightPatterns?: {
            pattern: string;
          }[];
          links?: {
            label: string;
            url: string;
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
              keywords: ["AI Agent", "Cloud Architecture", "LLM", "Azure"],
              description: [
                "Great things are happening here."
              ]
            },
            {
              title: "Lead Data Engineer & Software Development Engineer, Consultant",
              startDate: "Aug 2023",
              endDate: "Dec 2024",
              isCurrent: false,
              keywords: ["AI Chatbot", "RAG", "LangChain", "Automation"],
              description: [
                "AI‑powered Customer‑Service Chatbot (RAG, Azure + AWS): Architected and shipped a retrieval‑augmented LLM that now resolves ~70 % of inbound queries autonomously, deflecting ≈ 8000 tickets per month and paying back its build cost 525% in 12 months."
              ],
              links: [
                { label: "Product Page", url: "https://www.cgi.com/canada/en-ca/insurance-chatbot" },
                { label: "Promotional Article", url: "https://www.cgi.com/canada/en-ca/article/insurance/ai-chatbots-insurance-are-transforming-customer-service" }
              ],
              highlightPatterns: [
                { pattern: "RAG" },
                { pattern: "Azure|AWS" },
                { pattern: "525" }
              ]
            },
            {
              title: "Data Engineer, Consultant",
              startDate: "Aug 2021",
              endDate: "Jul 2023",
              isCurrent: false,
              keywords: ["Python", "SQL (T-SQL, PostgreSQL, SQL Server)", "Big Data", "Machine Learning", "Data Warehousing / ETL"],
              description: [
                "Database operations (SQL Server / 2 TB): Managed Canada’s largest automobile-insurance policy-history database, holding 99.9 % uptime and < 200 ms median queries.",
                "Micro data marts (Postgres / SQL Server): Designed 22+ single-purpose marts (≤ 4 tables, monthly refresh) for accounting & finance analytics, driving monthly report runtime down from 30 min to 5 minutes.",
                "ML fraud scoring: Shipped a gradient-boost loss-ratio model that lifted recovered fraud losses 321 % versus a top-5-bank benchmark, batch-scoring in a Python–T-SQL pipeline."
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
              keywords: ["Computer Vision", "PyTorch", "TensorFlow", "CNN-LSTM", "Active Learning", "Real-Time Systems"],
              description: [
                "Automated Sports Video Analysis (PyTorch / TensorFlow): Co-developed the AttentiveVision pipeline for hockey broadcast footage, training a CNN-LSTM stack that reached mAP ≈ 70% on event detection across 18 hours of game video.",
                "Real-Time Player Tracking System: Engineered a smooth-pursuit Kalman-filter tracker delivering < 100 ms latency at 30 FPS, capturing sub-pixel player trajectories for live speed & heat-map analytics.",
                "Action Spotting & Annotation Automation: Built an active-learning annotation loop that cut manual labelling effort and raised dataset reliability to κ ≈ 0.92."
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
              keywords: ["React", "TypeScript", "CI/CD", "Puppeteer", "Jest"],
              description: [
                "Homepage & Feature Revamp (React / TypeScript): Contributed major components to a company-wide homepage rewrite, working with senior devs to cut Time-to-Interactive ≈ 45%.",
                "Telus Product Pages: Partnered with UX, QA, and DevOps to launch two Telus product pages; reusable React components and CI hooks trimmed design-to-deploy turnaround from 10 to 3 days.",
                "Automated Visual Regression: Helped introduce a Puppeteer + Jest visual-diff pipeline that removed about 90% of manual QA checks and shaved 2 days off each sprint’s release gate."
              ],
              highlightPatterns: [
                { pattern: "React|TypeScript" }
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
