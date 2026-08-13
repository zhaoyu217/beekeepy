# HiveDash One-Screen Build

This is the refactored one-screen version of HiveDash.

## Core layout rule
At a 393×852 mobile viewport, the four main pages are designed to fit their core content without page scrolling:
- Home
- Hives
- Actions
- Insights

The header is fixed:
- Left: Settings
- Center: HiveDash
- Right: Notifications

The bottom navigation is fixed:
- Home
- Hives
- Actions
- Insights

Secondary pages may scroll:
- Settings
- Notifications
- Hive Detail
- Action-entry bottom sheets

## Included features
- Overall hive-health gauge
- Health status counts
- Action Center
- Risk Alerts
- Season Intelligence
- Hives list
- Hive detail
- Inspection / Feeding / Treatment / Harvest forms
- Insights / trends / risk prototype / honey analytics
- Settings
- Notification center
- Free / Pro plan UI
- Beekeeping Store link to https://www.skoghive.com
- LocalStorage data persistence
- JSON data export

## Upload to GitHub
Upload these items to the repository root:
- index.html
- css/
- js/
- README.md

Then enable GitHub Pages from the repository Settings → Pages.

## Important
This is a functional front-end prototype. Production still needs real authentication, cloud database, billing, push notifications, weather/bloom API, AI/photo-analysis backend, Privacy Policy and Terms.
