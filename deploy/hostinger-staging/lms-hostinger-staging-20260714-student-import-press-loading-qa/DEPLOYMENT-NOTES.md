Hostinger deployment package

Change set:
- Student import paste table opens with the template columns already filled as a real header row.
- Paste review stays disabled until at least one student row is present.
- Student import and enroll CTAs show pressed and loading states during work.

QA completed:
- npm run lint
- npm run build
- git diff --check
- npm test -- --runInBand
