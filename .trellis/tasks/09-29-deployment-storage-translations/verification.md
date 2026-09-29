# Deployment output measurement

Logical file sizes from the same local production build configuration:

| Output | Before (bytes) | After (bytes) |
| --- | ---: | ---: |
| Standalone | 1,287,918,079 | 71,573,772 |
| Shared static assets | 12,958,645 | 14,246,022 |
| Combined | 1,300,876,724 | 85,819,794 |
| Prerendered HTML | 334,248,938 | 18,237,288 |
| RSC output | 906,451,613 | 7,350,500 |
| UUID page RSC | 1,296,351 | 9,997 |

Combined output decreased **93.40%**. HTML and RSC rows are parts of the
standalone total, not extra output to add. File counts remained 234 HTML and
2,333 RSC files; the build generated the same 236 pages.

- Production build and its TypeScript phase passed.
- Targeted ESLint and whitespace checks passed.
- Representative HTML still contains translated page content; RSC no longer
  serializes the full resources prop.
- Production browser inspection confirmed English display, Chinese switch,
  Chinese restoration after reload, translated tool search, and switching back
  to English, with no JavaScript exceptions.
- Independent review confirmed shared resource data with per-provider i18next
  instances preserves the existing language behavior.
- The existing root layout defaults to English because it sits above the locale
  segment. That pre-existing routing behavior is unchanged by this storage fix.

These are local build bytes, **not Vercel billing measurements**. Cloud packaging
can differ, and existing retained deployments keep their previous artifacts.
Vercel Usage > Deployment Storage > Projects is needed to attribute actual team
usage; account retention/deletion settings were not changed.

Official references checked on 2026-09-29:

- https://vercel.com/docs/deployment-storage
- https://vercel.com/docs/deployment-storage/optimize
- https://vercel.com/docs/deployment-retention
- https://vercel.com/changelog/hobby-projects-now-retain-fewer-deployments-to-free-up-storage
