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
      }[];
    };
  };
}

export const aboutContent: AboutPageContent = {
  header: {
    title: "About Me",
    subtitle: "Engineering AI & Data Systems at Scale",
    description:
      "I am Qijin Xu (Jack), a Toronto-based lead AI and machine learning engineer delivering production AI systems that combine robust data engineering with modern LLM agents to move critical business metrics.",
  },
  sections: {
    bio: {
      title: "Bio",
      content: [
        {
          heading: "Summary",
          text: "Lead AI/ML Engineer delivering measurable impact via production AI systems. Drove 90% support reduction (525% ROI) with RAG for 50k+ users, and 50% labor reduction with LLM agents (LangGraph), drawing on full-stack expertise from data systems (Spark, Kafka), classic ML (321% fraud lift) to modern LLMs.",
        },
        {
          heading: "Expertise & Stack",
          text: "Python, Java, Go, TypeScript, SQL, Azure, AWS, GCP, Spark, Kafka, Airflow, LangGraph, RAG, MCP, OpenAI API, and full-stack ownership from ingestion to production AI services.",
        },
        {
          heading: "Credentials",
          text: "B.Sc. in Computer Science, York University | Microsoft Certified: Azure Solutions Architect Expert | Project Management Professional (PMP).",
        },
        {
          heading: "Beyond Code",
          text: "Open-source contributor, avid gamer, and builder of assistant tools that blend computer vision, machine learning, and gameplay analytics.",
        },
      ],
    },
    skills: {
      title: "Skills",
      categories: [
        {
          title: "AI & LLM Engineering",
          items: [
            "Large Language Models (LLMs)",
            "LangGraph agent workflows",
            "Retrieval-Augmented Generation (RAG)",
            "Model Context Protocol (MCP)",
            "OpenAI API / vLLM / Hugging Face",
            "Prompt and structured output design",
            "LoRA / PEFT fine-tuning",
          ],
        },
        {
          title: "Backend & System Design",
          items: [
            "Distributed systems and scalability",
            "Microservices and service mesh",
            "API design (REST / GraphQL)",
            "Database design (SQL and NoSQL)",
            "Event-driven architecture and CQRS",
            "Message queues (Kafka, RabbitMQ)",
          ],
        },
        {
          title: "Cloud & DevOps",
          items: [
            "Azure (Functions, AKS)",
            "AWS (EKS, Lambda, S3, ECS)",
            "GCP (Vertex, BigQuery)",
            "Docker and Kubernetes",
            "Terraform and infrastructure as code",
            "CI/CD (GitHub Actions, Azure DevOps)",
            "Observability (CloudWatch, Prometheus)",
          ],
        },
        {
          title: "Programming Languages",
          items: [
            "Python",
            "Java",
            "Go",
            "JavaScript / TypeScript",
            "SQL (T-SQL, PostgreSQL)",
            "C++",
            "Bash / Shell scripting",
          ],
        },
        {
          title: "Data & ML Infrastructure",
          items: [
            "Apache Spark",
            "Kafka",
            "Airflow",
            "Databricks and Delta Lake",
            "OpenLineage data lineage",
            "Vector stores (Pinecone, FAISS, Weaviate)",
            "Redis",
            "Feature stores (Feast)",
          ],
        },
        {
          title: "Full-Stack Development",
          items: [
            "React / Next.js",
            "tRPC and GraphQL",
            "Tailwind CSS",
            "Vercel and edge functions",
            "Auth0 and OAuth2",
            "Testing (Jest, Playwright)",
          ],
        },
      ],
    },
    experience: {
      title: "Experience",
      items: [
        {
          company: "CGI Inc.",
          roles: [
            {
              title: "Lead AI/ML Engineer (Tech Lead), AI Center of Excellence",
              startDate: "Jan 2025",
              endDate: "Present",
              isCurrent: true,
              keywords: ["LangGraph", "LLM Agents", "RAG", "vLLM", "PII Filtering"],
              description: [
                "LangGraph dual-state agent for a proprietary coding language: orchestrated vLLM-served LLMs with retrieval, EBNF structured outputs, and PII filtering to automate documentation, business-rule extraction, and migration readiness; targeting a 50% labor reduction for support teams.",
              ],
              highlightPatterns: [
                { pattern: "LangGraph" },
                { pattern: "50%" },
              ],
            },
            {
              title: "Data Architect and Engineering Lead, Senior Consultant",
              startDate: "Aug 2023",
              endDate: "Dec 2024",
              isCurrent: false,
              keywords: [
                "LangChain",
                "RAG",
                "Azure",
                "AWS",
                "GCP",
                "OpenLineage",
                "AxiomSL",
              ],
              description: [
                "CGI Impact Award 2024: Architected and shipped an LLM-powered enterprise RAG chatbot (LangChain across Azure, AWS, GCP) delivering about 90% autonomous resolution for a 50k+ user base and 525% ROI in 12 months.",
                "Built an OpenLineage-based lineage tool that auto-documents extensible multi-source flows with LLM-assisted root-cause suggestions, shrinking investigation cycles across three incidents per month.",
                "Automated AxiomSL rule updates with an LLM copilot for RBC, cutting manual updates by 80% while preserving governance controls.",
              ],
              highlightPatterns: [
                { pattern: "90%" },
                { pattern: "50k" },
                { pattern: "525%" },
                { pattern: "80%" },
                { pattern: "CGI Impact Award 2024" },
              ],
              links: [
                {
                  label: "Product Page",
                  url: "https://www.cgi.com/canada/en-ca/insurance-chatbot",
                },
                {
                  label: "Promotional Article",
                  url: "https://www.cgi.com/canada/en-ca/article/insurance/ai-chatbots-insurance-are-transforming-customer-service",
                },
              ],
            },
            {
              title: "Data Engineer, Consultant",
              startDate: "Aug 2021",
              endDate: "Jul 2023",
              isCurrent: false,
              keywords: [
                "Python",
                "SQL (T-SQL, PostgreSQL, SQL Server)",
                "Big Data",
                "Machine Learning",
                "Data Warehousing / ETL",
              ],
              description: [
                "Managed the largest automobile-insurance policy-history database in Canada (2 TB on SQL Server) with 99.9% uptime and median queries under 200 ms.",
                "Delivered production ETL and ELT pipelines for 22+ micro data marts (each under six tables with monthly SLAs), trimming report runtimes from 30 minutes to 5 minutes.",
                "Shipped a Gradient-Boost plus Logistic Regression loss-ratio model that recovered fraud losses 321% versus a top-5 bank benchmark through a Python and T-SQL pipeline.",
              ],
              highlightPatterns: [
                { pattern: "largest" },
                { pattern: "321%" },
                { pattern: "top-5 bank" },
              ],
            },
          ],
        },
        {
          company: "Elder Laboratory, York University",
          roles: [
            {
              title: "Research Assistant, Computer Vision (Part-Time)",
              startDate: "May 2020",
              endDate: "Aug 2021",
              isCurrent: false,
              keywords: [
                "Computer Vision",
                "PyTorch",
                "TensorFlow",
                "CNN-LSTM",
                "Active Learning",
                "Real-Time Systems",
              ],
              description: [
                "Developed AttentiveVision, a computer-vision pipeline for hockey broadcast video in Python (PyTorch, TensorFlow, OpenCV), training a CNN-LSTM stack with mean average precision above 70% on event detection across 18 hours of game footage.",
                "Engineered a real-time player tracking system using a Kalman-filter tracker that delivered under 100 ms latency at 30 FPS, capturing pose and movement for live speed and heat-map analytics.",
                "Created an event-detection annotation loop (goal, timeout, penalty) with active learning that cut manual labeling effort and raised dataset reliability to Cohen's kappa of 0.92.",
              ],
              highlightPatterns: [
                { pattern: "ML pipelines" },
                { pattern: "PyTorch|TensorFlow" },
                { pattern: "real-time" },
                { pattern: "0.92" },
              ],
            },
          ],
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
                "Built end-to-end features with React, TypeScript, and Node.js; contributed major components to company-wide homepage rewrite.",
                "Shipped TELUS product pages by partnering with UX/QA/DevOps and creating reusable React components plus CI/CD hooks; finished design-to-deploy in 7 days.",
                "Introduced automated visual-regression testing with Nightwatch.js and Puppeteer; removed ~90% of manual QA checks.",
              ],
              highlightPatterns: [{ pattern: "React|TypeScript" }],
            },
          ],
        },
      ],
    },
    education: {
      title: "Education",
      items: [
        {
          degree: "B.Sc. in Computer Science (Specialized Honours)",
          institution: "York University, Toronto",
          startDate: "2017",
          endDate: "2021",
          description: [
            "Graduated with GPA 3.9/4.0",
            "First Class with Distinction",
          ],
        },
      ],
    },
    certificates: {
      title: "Certifications",
      items: [
        {
          name: "Microsoft Certified: Azure Administrator Associate",
          issuer: "Microsoft",
          date: "2022",
        },
        {
          name: "Project Management Professional (PMP)",
          issuer: "Project Management Institute",
          date: "2023",
        },
      ],
    },
  },
};
