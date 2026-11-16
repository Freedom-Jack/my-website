/**
 * The questions each line of the site answers ("Ask the painting"; read by tools/build-ask.ts into the index).
 *
 * A small embedding model is far better at "are these two the same question?" than at "does this line answer that
 * question?". So every line that answers something is filed under the questions it answers, and a visitor's
 * question is measured against those as well as against the lines themselves. The questions are an index and are
 * never shown: an answer is always the line itself, word for word, as content/ has it.
 *
 * Each entry names its line by its opening words (a whole unit of the corpus, or one sentence inside a unit). The
 * index build fails when an opening no longer matches exactly one line: the words changed, so the entry is read
 * again by a person. Written for round 6 by the site's builder, not by Jack; nothing here states a fact.
 * (The things a skills or a stack line names are filed by the build itself, "Do you know X?": lines.ts.)
 */
export const QUESTIONS: [opens: string, questions: string[]][] = [
  // ---------------------------------------------------------------- Home
  [
    'Lead AI/ML Architect at CGI’s AI Center of Excellence in Toronto. I design',
    [
      'Who are you?',
      'What do you do?',
      'Tell me about yourself',
      'What is your job?',
      'What is your job title?',
      'What is your current role?',
      'Where do you work?',
      'Which company do you work for?',
      'Where are you based?',
      'What city are you in?',
      'What kind of AI do you build?',
      'Which industries do you work in?',
    ],
  ],
  [
    'Right now I’m leading an agent',
    ['What are you working on right now?', 'What is your current project?', 'What are you leading at the moment?'],
  ],
  [
    'I’ve spent the last five years',
    ['How long have you worked in AI?', 'How many years of experience do you have?', 'What is your background?'],
  ],
  [
    'Along the way the work earned two CGI Impact Awards',
    [
      'What do you enjoy most about your work?',
      'What part of the work do you like best?',
      'Have you won any awards?',
      'What awards have you won?',
    ],
  ],
  [
    'I also build for myself.',
    ['Do you build your own tools?', 'Do you have side projects?', 'What do you build for yourself?'],
  ],
  [
    'Away from the keyboard',
    [
      'What do you do outside of work?',
      'What are your hobbies?',
      'What do you do for fun?',
      'Do you play any sports?',
      'What do you like to read?',
      'Do you play video games?',
    ],
  ],
  ['Qijin Xu is a Lead AI/ML Architect', ['Who is Qijin Xu?', 'Who is Jack Xu?', 'Give me a short bio']],
  [
    'About 90% of questions resolved without a person, for 50,000+',
    [
      'How many users did the insurance assistant serve?',
      'How well did the support assistant work?',
      'What share of questions did the assistant resolve on its own?',
    ],
  ],
  [
    'An agent that documents legacy code in a proprietary language and pulls out',
    ['How much manual work will the agent save?', 'What does the legacy code agent pull out?'],
  ],
  [
    '99.9% uptime on Canada’s largest auto-insurance',
    ['What was the uptime of the database?', 'How big was the policy-history database?'],
  ],
  [
    'Building: an agent memory system',
    [
      'What are you building now?',
      'What are you building in your own time?',
      'What is Logic Foundry?',
      'Are you working on agent memory?',
    ],
  ],
  ['Exploring: an AI-powered stock app.', ['What are you exploring?', 'What are you curious about lately?']],
  [
    'For collaborations on production AI, or an invitation',
    [
      'How can I contact you?',
      'What is your email address?',
      'How do I reach you?',
      'Are you on LinkedIn?',
      'Are you on GitHub?',
      'Can I invite you to speak?',
      'Can we work together?',
      'Are you open to collaborations?',
      // (the site says nothing about new roles: such a question is shown where to write, nothing more)
      'Are you open to new opportunities?',
      'Can I hire you?',
    ],
  ],

  // ---------------------------------------------------------------- Work
  [
    'Most of what I build runs inside client systems',
    ['Can I see your code?', 'Is your work open source?', 'Why is the code not public?'],
  ],
  [
    'A model is only as good as the system around it.',
    ['What is your philosophy on AI?', 'What do you believe about building AI?', 'What matters most in an AI system?'],
  ],
  [
    'For five years I’ve built those systems',
    ['How do you build AI systems?', 'What does your architecture look like?', 'What are the layers of your systems?'],
  ],
  ['Lineage records where each piece of data came from', ['What is data lineage?', 'Do you use OpenLineage?']],
  [
    'The prepared data is indexed for search',
    ['Which vector database do you use?', 'Do you use FAISS or Pinecone?', 'How do you index data for search?'],
  ],
  [
    'A request reaches the agent workflow',
    ['How do your agents decide what to do next?', 'What runs your agent workflows?'],
  ],
  ['The workflow calls vLLM-served models', ['How do you serve language models?', 'Do you host your own models?']],
  [
    'Guardrails: PII filtering keeps',
    [
      'What guardrails do you use?',
      'How do you keep AI output safe?',
      'How do you keep personal data out of a model?',
      'How do you make sure the output is well-formed?',
    ],
  ],

  // ---------------------------------------------------------------- the agent for a proprietary language
  [
    'An agent that reads legacy code in a proprietary language, documents it',
    [
      'What is the proprietary language agent?',
      'Tell me about the legacy code project',
      'What does the code agent do?',
    ],
  ],
  [
    'A client’s business rules live in legacy scripts',
    ['What problem does the agent solve?', 'Why can’t a general model handle the proprietary language?'],
  ],
  [
    'I lead the agent’s design and delivery.',
    ['What is your part in the agent project?', 'How does the agent work?', 'How is the agent designed?'],
  ],
  ['An open-source library for building agents as graphs', ['What is LangGraph?']],
  ['An open-source engine for serving large language models.', ['What is vLLM?']],
  [
    'Extended Backus–Naur form',
    ['What is EBNF?', 'What is a grammar-constrained output?', 'What are structured outputs?'],
  ],
  ['Personally identifiable information', ['What is PII?', 'What does PII mean?']],
  [
    'Projected 50% less manual work. In progress.',
    ['What is the status of the agent project?', 'What result is expected from the agent?'],
  ],
  ['Python, LangGraph, vLLM, RAG, EBNF structured outputs', ['What is the agent built with?']],

  // ---------------------------------------------------------------- the RAG assistant
  [
    'An LLM-powered assistant that answers routine insurance questions',
    // (the page's own example, "What did you build for insurers?", is left out on purpose: the model has to find it)
    ['What is the insurance assistant?', 'Tell me about the RAG assistant', 'Have you built a chatbot?'],
  ],
  [
    'Insurance support teams spend much of their day',
    ['What problem did the assistant solve?', 'Why was the insurance assistant built?'],
  ],
  [
    'I architected and shipped the system: retrieval-augmented generation',
    ['What was your part in the RAG assistant?', 'How was the insurance assistant built?'],
  ],
  [
    'Retrieval-augmented generation. The model answers from passages',
    ['What is RAG?', 'What does retrieval-augmented generation mean?', 'How does RAG work?'],
  ],
  ['An open-source framework for building applications on language models.', ['What is LangChain?']],
  [
    'About 90% of questions resolved without a person, across a user base',
    [
      'What were the results of the assistant?',
      'What was the return on investment?',
      'What was the ROI of the chatbot?',
      'Did the assistant win an award?',
    ],
  ],
  ['The system runs across Azure, AWS and GCP.', ['Which clouds does the assistant run on?']],
  ['Python, LangChain, LLMs, RAG, Azure, AWS, GCP', ['What is the assistant built with?']],

  // ---------------------------------------------------------------- lineage and rule automation
  [
    'Two tools that put language models to work on data operations',
    ['Have you used language models for data operations?', 'What are the lineage and rule tools?'],
  ],
  ['When a report breaks, someone has to trace', ['What problem did the lineage tool solve?']],
  [
    'I built an OpenLineage-based lineage tool that documents',
    ['What did you build for RBC?', 'What was your part in the lineage project?', 'Have you worked with AxiomSL?'],
  ],
  ['80% less manual work on AxiomSL rule updates. Shorter', ['What were the results of the rule automation?']],

  // ---------------------------------------------------------------- the fraud model
  [
    'A loss-ratio model that recovers more fraud losses',
    ['Have you worked on fraud detection?', 'What is the fraud model?'],
  ],
  [
    'I built and shipped a gradient-boosting plus',
    [
      'How was the fraud model built?',
      'Which algorithms did the fraud model use?',
      'Have you done classic machine learning?',
    ],
  ],
  [
    '321% lift in recovered fraud losses versus',
    ['What were the results of the fraud model?', 'How much more fraud did the model recover?'],
  ],

  // ---------------------------------------------------------------- the insurance data platform
  [
    'Kept Canada’s largest auto-insurance policy-history database fast',
    [
      'What is the insurance data platform?',
      'Have you managed large databases?',
      'Do you have data engineering experience?',
    ],
  ],
  [
    'I managed the database and built production ETL/ELT pipelines',
    ['What was your part in the data platform?', 'Have you built ETL pipelines?', 'What data marts did you build?'],
  ],
  [
    '99.9% uptime. Median queries under 200 ms.',
    ['How fast were the queries?', 'What were the results of the data platform?'],
  ],

  // ---------------------------------------------------------------- hockey vision
  [
    'Models that watch a hockey broadcast',
    ['What is the hockey project?', 'Have you worked in computer vision?', 'Tell me about the hockey video work'],
  ],
  ['AttentiveVision, a startup co-founded', ['What is AttentiveVision?', 'Who was the hockey project for?']],
  [
    'I trained a CNN-LSTM stack for event detection',
    [
      'What was your part in the hockey project?',
      'How did you track the players?',
      'Which models did you train for hockey video?',
    ],
  ],
  [
    'mAP ≥ 70% on event detection across 18 hours of game video. Tracking',
    ['How accurate was the hockey model?', 'What were the results of the hockey project?'],
  ],

  // ---------------------------------------------------------------- the note
  [
    'AI agents are software systems that use AI to pursue goals',
    ['What is an AI agent?', 'How do you define an AI agent?'],
  ],
  [
    'So AI agents are something that should be capable',
    ['What is an AI agent in your own words?', 'How is an agent different from traditional AI?'],
  ],
  ['Perceive: Gathers input', ['What are the components of an AI agent?', 'What are the parts of an agent?']],
  [
    'An AI agent is capable of completing tasks on your behalf',
    ['What is the difference between an AI agent and an AI assistant?', 'Agent versus assistant?'],
  ],
  ['An AI assistant, on the other hand', ['What is an AI assistant?']],

  // ---------------------------------------------------------------- the Résumé
  [
    'CGI Impact Award 2026: led development of an LLM-powered email agent',
    ['What was the 2026 Impact Award for?', 'Tell me about the email agent', 'Have you built an email agent?'],
  ],
  [
    'Architected a scalable agent evaluation pipeline',
    [
      'How do you evaluate agents?',
      'How do you test AI agents?',
      'Do you use LLM-as-a-judge?',
      'How do you know an agent works?',
    ],
  ],
  [
    'Drive technical direction across 13+ AI initiatives for TD Bank',
    [
      'What do you do for TD Bank?',
      'Do you lead a team?',
      'How big is your team?',
      'Which banks have you worked with?',
    ],
  ],
  ['CGI Impact Award 2024: architected and shipped', ['What was the 2024 Impact Award for?']],
  ['Automated AxiomSL rule updates at RBC', ['Have you worked with RBC?']],
  [
    'Built an event-detection annotation loop',
    ['Have you used active learning?', 'How did you label the hockey data?'],
  ],
  [
    'Built features in React, TypeScript, and Node.js',
    [
      'Do you have front-end experience?',
      'Have you worked with React?',
      'What did you do as an intern?',
      'Did you work at TELUS?',
    ],
  ],
  [
    'Lead AI/ML Architect and Tech Lead at CGI’s AI Center of Excellence with 5+ years',
    ['Summarize your career', 'What is your professional summary?', 'What are your strengths?'],
  ],
  ['Python, Java, Go, SQL', ['What programming languages do you know?', 'Which languages do you code in?']],
  [
    'PyTorch, JAX, LangGraph, RAG, agent workflows',
    ['What is your tech stack?', 'What AI frameworks do you use?', 'Do you use the Model Context Protocol?'],
  ],
  ['Apache Spark, Kafka, Airflow', ['What data tools do you use?', 'Do you know Spark?', 'Do you use Airflow?']],
  [
    'Azure, GCP, AWS, Docker, Kubernetes',
    ['Which cloud platforms have you used?', 'What infrastructure tools do you use?'],
  ],
  [
    'B.Sc. Computer Science, Specialized Honours',
    ['What degree do you have?', 'What did you study?', 'What is your education?'],
  ],
  ['York University', ['Where did you study?', 'Which university did you attend?', 'Where did you go to school?']],
  ['First in Class', ['How did you do at university?', 'What were your grades like?']],
  [
    'Microsoft Certified: Azure Solutions Architect Expert',
    ['What certifications do you have?', 'Are you Azure certified?'],
  ],
  ['Google Cloud Professional Cloud Developer', ['Are you Google Cloud certified?']],
  ['For architecting and shipping an LLM-powered enterprise RAG assistant.', ['What were your awards for?']],

  // ---------------------------------------------------------------- Contact
  [
    'I’m always glad to hear about collaborations',
    ['What would you like to hear about?', 'Do you give talks?', 'Do you write about AI?'],
  ],
];
