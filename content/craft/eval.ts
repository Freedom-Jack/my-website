/**
 * DRAFT (for Jack): the evaluation set behind the eval fold on Work ("How good is the search?"). Twenty questions a
 * visitor might ask these pages, written by the site's author (not Jack), each with the passage that answers it (named
 * by a phrase it contains; the build resolves it to its passage). Recall@1 and @3 of the lexical search are computed at
 * build from this list and printed with n, the author and every miss. Nothing in the search is tuned on these
 * questions (BM25's defaults, a stop list and a score floor fixed beforehand). Jack's own held-out set replaces them.
 */
export const evalSet: ReadonlyArray<{ q: string; gold: string | readonly string[] }> = [
  {
    q: 'How many users did the insurance assistant serve?',
    gold: 'for 50,000+ users of an insurance support assistant',
  },
  { q: 'What was the return on investment of the RAG assistant?', gold: '525% ROI within 12 months' },
  {
    q: 'Which framework orchestrated the insurance assistant?',
    gold: 'built with LangChain across Azure, AWS and GCP',
  },
  {
    q: 'What does the agent for the proprietary language produce?',
    gold: 'The agent writes documentation, extracts business rules',
  },
  {
    q: 'What keeps every output of the agent well-formed?',
    gold: 'EBNF grammars constrain every output to what the grammar allows',
  },
  {
    q: 'How much manual work is the proprietary-language agent expected to save?',
    gold: 'Projected 50% less manual work. In progress.',
  },
  {
    q: 'What tool documents where data came from?',
    // the case and the résumé both say it, in two wordings; either passage answers
    gold: [
      'OpenLineage-based lineage tool that documents multi-source data flows',
      'OpenLineage-based lineage tool that auto-documents',
    ],
  },
  {
    q: 'How much less manual work on AxiomSL rule updates?',
    gold: '80% less manual work on AxiomSL rule updates. Shorter investigations',
  },
  {
    q: 'What was the lift in recovered fraud losses?',
    gold: '321% lift in recovered fraud losses versus the top-five bank benchmark',
  },
  { q: 'What kind of model scored the fraud loss ratio?', gold: 'gradient-boosting plus logistic-regression model' },
  {
    q: 'How big was the policy-history database?',
    gold: 'A 2 TB SQL Server database of automobile-insurance policy history',
  },
  { q: 'What uptime did the insurance data platform reach?', gold: '99.9% uptime. Median queries under 200 ms' },
  {
    q: 'How many data marts did he build pipelines for?',
    gold: 'production ETL/ELT pipelines for 22+ micro data marts',
  },
  {
    q: 'What accuracy did the hockey event detection reach?',
    gold: 'mAP ≥ 70% on event detection across 18 hours of game video',
  },
  {
    q: 'How were hockey players tracked in real time?',
    gold: 'real-time player tracking with a Kalman filter and OpenPose',
  },
  { q: 'Which awards has he won?', gold: 'the work earned two CGI Impact Awards' },
  {
    q: 'What did the 2026 CGI Impact Award recognise?',
    gold: '89% autonomous handling across 2,000+ emails per month',
  },
  {
    q: 'How is an AI agent different from an AI assistant?',
    gold: 'An AI agent is one step further than an AI assistant',
  },
  { q: 'Which cloud certifications does he hold?', gold: 'Microsoft Certified: Azure Solutions Architect Expert' },
  {
    q: 'What does he do away from the keyboard?',
    gold: 'I play basketball, play games, and read wuxia and xianxia novels',
  },
];
