# STATOMERA

**Statistical Data Intelligence**

STATOMERA is a bilingual, browser-local workspace for statistical data analysis. Open a dataset, inspect its quality, and ask questions in English, Arabic, or both. Reports and charts trace findings to verified results and their assumptions.

The dataset profiler opens local CSV, flat JSON and supported XLSX files and shows a preview, inferred types, quality counts and numerical or categorical summaries in English and Arabic. The first public beta still targets zero project spend.

## Run the profiler locally

Use Node.js 22.18 or newer. From the repository root, run:

```sh
npm ci --ignore-scripts
npm test
npm run build:portable
npm run preview:portable -- --host 127.0.0.1
```

Open the loopback address printed by Vite and choose `tests/fixtures/salary.csv`. Expect five records, three valid salaries, one blank, one invalid, and a mean of 20. Try `tests/fixtures/mixed.csv` with the common missing-marker option enabled to see a generic profile. [Phase 2A report](docs/PHASE_2A_REPORT.md)

## Project documentation

- [Phase 2D data workspace](docs/PHASE_2D_REPORT.md)
- [Phase 2C format support and verification](docs/PHASE_2C_REPORT.md)
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
- [STATOMERA brand identity](docs/BRAND_IDENTITY.md)
- [Rebranding implementation and verification](docs/REBRANDING_IMPLEMENTATION.md)

Historical Askora phase records and the original brand reference board remain part of the project history. Repository visibility and project licensing are open decisions.
