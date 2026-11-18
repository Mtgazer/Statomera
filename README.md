# Askora

Askora is a bilingual conversational data analysis workspace in development. Users will open a dataset in their browser, inspect its quality and ask questions in English, Arabic or both. Answers will use real analytical computations and show the data and assumptions behind them.

The CSV profiler opens local CSV files and shows a preview, inferred types, quality counts and numerical or categorical summaries in English and Arabic. The first public beta still targets zero project spend.

## Run the profiler locally

Use Node.js 22.18 or newer. From the Askora repository root, run:

```sh
npm ci --ignore-scripts
npm test
npm run build:portable
npm run preview:portable -- --host 127.0.0.1
```

Open the loopback address printed by Vite and choose `tests/fixtures/salary.csv`. Expect five records, three valid salaries, one blank, one invalid, and a mean of 20. Try `tests/fixtures/mixed.csv` with the common missing-marker option enabled to see a generic profile. [Phase 2A report](docs/PHASE_2A_REPORT.md)

## Project documentation

- [Phase 2A profiler and verification](docs/PHASE_2A_REPORT.md)
- [Phase 1B build and deployment measurements](docs/PHASE_1B_REPORT.md)
- [Phase 1A results and test commands](docs/PHASE_1A_REPORT.md)
- [Codex skills setup](docs/CODEX_SKILLS.md)
- [Phase 0 report and proof-of-concept plan](docs/PHASE_0_REPORT.md)
- [Product brief and requirements matrix](docs/PROJECT_BRIEF.md)
- [Architecture, technology comparison and hosting](docs/ARCHITECTURE.md)
- [Development roadmap](docs/ROADMAP.md)
- [Testing strategy](docs/TESTING.md)
- [Security principles](docs/SECURITY.md)
- [Decision log](docs/DECISIONS.md)
- [Brand guidelines](docs/BRAND_GUIDELINES.md)

The original project history and brand reference board were supplied alongside this checkout. Repository visibility and project licensing are open decisions.
