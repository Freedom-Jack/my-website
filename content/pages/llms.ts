/**
 * /llms.txt (COPY.md §8.8): a plain-language summary of the site for AI agents, following the llms.txt
 * convention. Facts only, each one also visible on the site. Never instructions to the reader.
 * Page addresses are added from content/site.ts `url`; the case pages and the "Now" line's month come from
 * content/work/ and content/pages/home.ts (src/app/llms.txt/route.ts); the "Now" line is Home's own.
 */
export const llms = {
  summary:
    'Qijin Xu, known as Jack, is a Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto, Canada. He designs and ships production AI for banks and insurers: LLM agents, retrieval-augmented generation (RAG) systems, and the data platforms beneath them. He has {{years+}} years of experience.',
  /** Every project and credential on the site, in the site's own words (the résumé and the case pages). */
  facts: [
    'Two CGI Impact Awards: 2024, for architecting and shipping the LLM-powered enterprise RAG assistant, and 2026 (project not named on this site).',
    'Architected an LLM-powered RAG assistant for insurance support (2023 – 2024; LangChain; Azure, AWS, GCP): about 90% of questions resolved without a person, for 50,000+ users; 525% ROI within 12 months.',
    'Leads an agent for a proprietary programming language (2025 – present; LangGraph, vLLM, RAG, EBNF structured outputs, PII filtering) that documents legacy code and extracts its business rules. Projected 50% less manual work; in progress.',
    'Built an OpenLineage-based lineage tool with LLM-assisted root-cause suggestions, and automated AxiomSL rule updates at RBC with an LLM: 80% less manual updating (2023 – 2024).',
    'Managed Canada’s largest automobile-insurance policy-history database (2 TB, SQL Server): 99.9% uptime, median queries under 200 ms; built ETL/ELT pipelines for 22+ data marts (2021 – 2023).',
    'Shipped a fraud loss-ratio model: a 321% lift in recovered fraud losses versus a top-five bank benchmark (2021 – 2023).',
    'Research assistant in computer vision at York University’s Elder Laboratory (2020 – 2021): event detection on hockey broadcast video at mAP ≥ 70%.',
    'B.Sc. Computer Science, Specialized Honours, York University, 2017 – 2021 (GPA 3.9/4.0, Dean’s List).',
    'Microsoft Certified: Azure Solutions Architect Expert (2022). Google Cloud Professional Cloud Developer (2023).',
  ],
  pages: [
    { label: 'Home', path: '/', what: 'who he is, in his own words, and what he works on now' },
    {
      label: 'Work',
      path: '/work/',
      what: 'six projects, each on its own page with context, outcome, evidence links and stack (listed below), and his public repositories',
    },
    { label: 'Résumé', path: '/resume/', what: 'the résumé' },
    { label: 'Résumé (PDF)', path: '/resume.pdf', what: 'the same résumé as a PDF' },
    { label: 'JSON Resume', path: '/resume.json', what: 'machine-readable résumé' },
    { label: 'Writing', path: '/writing/', what: 'one note, “What is an AI agent?” (April 2025)' },
    {
      label: 'Contact',
      path: '/contact/',
      what: 'qxjack@gmail.com, for collaborations on production AI and invitations to speak or write about agents, retrieval, and AI architecture',
    },
  ],
  evidence: [
    { label: 'CGI insurance chatbot product page', url: 'https://www.cgi.com/canada/en-ca/insurance-chatbot' },
    {
      label: 'CGI article on AI chatbots for insurance',
      url: 'https://www.cgi.com/canada/en-ca/article/insurance/ai-chatbots-insurance-are-transforming-customer-service',
    },
    {
      label: 'Vector Institute article on the AttentiveVision hockey project',
      url: 'https://vectorinstitute.ai/amateur-hockey-given-professional-viewing-experience-courtesy-of-machine-vision-startup-co-founded-by-vector-researcher/',
    },
    { label: 'GitHub: Logic Foundry', url: 'https://github.com/Freedom-Jack/logic-foundry' },
    { label: 'GitHub: Freedom-Jack', url: 'https://github.com/Freedom-Jack' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/qijin-x-4899671a9/' },
  ],
};
