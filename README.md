# Askora

Askora is a bilingual conversational data analysis workspace in development. Users will open a dataset in their browser, inspect its quality and ask questions in English, Arabic or both. Answers will use real analytical computations and show the data and assumptions behind them.

The current Phase 1A proof opens local CSV files and verifies salary analysis in English and Arabic. The first public beta still targets zero project spend.

## Run the proof locally

Use Node.js 22.18 or newer. From the Askora repository root, run:

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run preview -- --host 127.0.0.1
```

Open the loopback address printed by Vite and choose `tests/fixtures/salary.csv`. Expect five records, three valid salaries, one blank, one invalid, and a mean of 20. See the [Phase 1A report](docs/PHASE_1A_REPORT.md) for the input policy, browser commands and known limits.

## Project documentation

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
