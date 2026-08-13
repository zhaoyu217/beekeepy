# HiveDash V9 — Architecture Refactor

V9 is a clean rewrite, not a CSS patch over V8.

## Major changes
- Clean single-source CSS architecture
- Fixed header: Settings / HiveDash / Notifications
- Fixed bottom nav: Home / Hives / Actions / Insights
- 48–58 px glove-friendly touch targets
- Main pages remain one-screen; secondary pages can scroll
- Free plan hard limit: 3 hives
- Pro gates: Health Analysis, Risk Prediction, advanced Trends, Season Intelligence
- All Hives page with search/filter
- All Actions page
- Actions generated automatically from hive records/settings
- Expanded Inspection data structure
- Health Score explanation
- Units affect harvest input/output
- Non-working language selector removed
- Unimplemented Photo/Voice/Cloud features marked Coming Soon
- User-generated text escaped before rendering
- Shop section clearly says Powered by SkogHive
- Notification deep links work
- Privacy/Terms/Help/Support routes are functional placeholders
- LocalStorage is still prototype-only

## Still required before production
- Real authentication
- Cloud database and sync
- Real billing entitlement
- Real push notifications
- Weather/bloom APIs
- AI/photo-analysis backend
- Voice recording / speech-to-structured data
- Final Privacy Policy and Terms
- Server-side validation and security review
