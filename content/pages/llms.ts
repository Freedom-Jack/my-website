/**
 * /llms.txt (COPY.md §8.8): a plain-language summary of the site for AI agents, following the llms.txt
 * convention. Facts only, each one also visible on the site. Never instructions to the reader.
 * Page addresses are added from content/site.ts `url`.
 */
export const llms = {
  summary:
    "Qijin Xu, known as Jack, is a Lead AI/ML Architect at CGI's AI Center of Excellence in Toronto, Canada. He designs and ships production AI for banks and insurers: LLM agents, retrieval-augmented generation (RAG) systems and the data platforms beneath them. {{years+}} years of experience.",
  facts: [
    'Architected an LLM-powered RAG support assistant: about 90% autonomous resolution for 50,000+ users, 525% ROI within 12 months. CGI Impact Award 2024.',
    'CGI Impact Award 2026.',
    'Leads a LangGraph agent for a proprietary programming language (vLLM, RAG, EBNF structured outputs, PII filtering). Projected 50% reduction in manual work.',
    'Built a fraud loss-ratio model with a 321% lift in recovered fraud losses versus a top-five bank benchmark.',
    'B.Sc. Computer Science, Specialized Honours, York University, 2017–2021 (GPA 3.9/4.0).',
    'Microsoft Certified: Azure Solutions Architect Expert (2022). Google Cloud Professional Cloud Developer (2023).',
  ],
  pages: [
    { label: 'Home', path: '/', what: 'who he is, in his own words, and what he works on now' },
    {
      label: 'Work',
      path: '/work/',
      what: 'six projects, each on its own page with context, outcomes, evidence links and stack, and his public repositories',
    },
    { label: 'Résumé', path: '/resume/', what: 'the résumé' },
    { label: 'Résumé (PDF)', path: '/resume.pdf', what: 'the same résumé as a PDF' },
    { label: 'JSON Resume', path: '/resume.json', what: 'machine-readable résumé' },
    { label: 'Writing', path: '/writing/', what: 'notes, including "What is an AI agent?" (2025)' },
    {
      label: 'Contact',
      path: '/contact/',
      what: 'qxjack@gmail.com, for collaborations on production AI and invitations to speak',
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
    { label: 'GitHub: Freedom-Jack', url: 'https://github.com/Freedom-Jack' },
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/qijin-x-4899671a9/' },
  ],
};
