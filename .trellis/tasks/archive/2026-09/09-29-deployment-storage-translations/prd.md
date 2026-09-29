# Reduce deployment storage from duplicated translations

## Problem

The user reported a Vercel Hobby team Deployment Storage warning at 75%.
Local production artifacts show that the root layout serializes both complete
locale dictionaries into every prerendered page and multiple RSC segments.
The standalone output contains 1,287,918,079 logical bytes, dominated by repeated
HTML/RSC resources. This local number is not a measurement of Vercel billing.

## Scope

- Import the two dictionaries once in the shared client translation provider.
- Pass only locale and children across the server/client boundary.
- Preserve translated SSR, immediate locale switching, stored preferences, all
  translation keys, routes, and Docker standalone output.
- Measure production output before/after and document the storage contract.
- Continue the user's authorized refactoring and normal remote submission.
- Account-side deletion and paid upgrades are outside this code change.

## Acceptance

- [x] Shared dictionaries eliminate repeated resource props from HTML/RSC.
- [x] Production build succeeds and measured output is substantially smaller.
- [x] Translation behavior and retained route count are preserved.
- [x] Documented changes are committed and ready for normal origin push.
