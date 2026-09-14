# NovaTrack Teacher Hub — App Store Metadata

## App Identity
- **App Name**: NovaTrack Teacher Hub
- **Subtitle** (30 chars max): Special Ed Data & IEP Tools
- **Bundle ID**: com.novatrack.teacherhub
- **SKU**: novatrack-teacher-hub-001
- **Primary Language**: English (U.S.)
- **Category**: Education
- **Secondary Category**: Productivity

## Pricing
- **Price Tier**: Free (or Freemium — your choice)

## App Description (4000 chars max)
```
NovaTrack Teacher Hub is the all-in-one data platform built for special education teachers and behavior support staff.

LOG FASTER
• One-tap ABC logging — antecedent, behavior, consequence in seconds
• Start/stop duration stopwatch — no more mental math
• Session templates — save your most-used A+B+C presets
• Duplicate prevention — blocks accidental double-logs within 8 seconds
• Behavior function analysis — automatically surfaces hypothesized behavioral functions from your data

DATA COLLECTION
• Frequency, duration, interval, and probe-based data collection
• IEP goal tracking with mastery thresholds (customizable per skill)
• ABC/trigger tracking with intensity ratings
• CSV export for all data types

IEP TOOLS
• Upload and AI-analyze IEP PDFs — extracts goals, progress, services, and accommodations
• Compare two IEP versions side by side with a goal-by-goal diff
• AI IEP writer with data-informed baselines from real behavioral logs
• BIP (Behavior Intervention Plan) workflow with supervisor approval

TEAM & SUPERVISOR TOOLS
• Supervisor signal dashboard — watch, action, and critical alerts
• Staff onboarding workflow
• Parent reports and snapshots
• Multi-classroom and multi-workspace support

GAMIFICATION
• Points, rewards, and avatar system for students
• Classroom game board with live mode display

NovaTrack is designed for special education teachers, board-certified behavior analysts (BCBAs), paraeducators, and school support teams who need fast, accurate, IDEA-compliant data collection without the paperwork.

Privacy-first: student data is never sold or shared with advertisers.
```

## Keywords (100 chars max, comma-separated)
special education,data collection,IEP,ABC data,behavior tracking,BCBA,ABA,teacher tools,SPED

## Support URL
https://novatrack.app/support

## Privacy Policy URL
https://[your-deployed-url]/privacy

## Marketing URL (optional)
https://novatrack.app

## Version Release Notes (What's New)
```
1.0.0 — Initial release

• Fast ABC behavioral logging with duration stopwatch
• AI-powered IEP document analysis and goal extraction
• BIP workflow with supervisor approval process
• Session templates for quick setup
• Behavior function hypothesis based on consequence patterns
• CSV data export
• Classroom game board and reward system
```

---

## GitHub Actions Secrets Required

Add these in GitHub → Settings → Secrets and Variables → Actions:

| Secret | Description |
|--------|-------------|
| `IOS_DISTRIBUTION_CERT_BASE64` | Base64-encoded `.p12` distribution certificate |
| `IOS_DISTRIBUTION_CERT_PASSWORD` | Password for the `.p12` |
| `KEYCHAIN_PASSWORD` | Any strong password (used only during CI) |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64-encoded App Store provisioning profile |
| `IOS_PROVISIONING_PROFILE_NAME` | Profile name (from Xcode / Apple Developer portal) |
| `APPLE_TEAM_ID` | Your 10-character Apple Developer Team ID |
| `APPLE_API_KEY_ID` | App Store Connect API key ID |
| `APPLE_API_KEY_ISSUER` | App Store Connect API issuer UUID |
| `APPLE_API_KEY_BASE64` | Base64-encoded `.p8` API key file |

## Steps to Complete on Your Mac

1. `git pull` to get the ios/ directory
2. Open `ios/App/App.xcworkspace` in Xcode
3. Set Team to your Apple Developer team (Signing & Capabilities tab)
4. Set Deployment Target to iOS 14.0+
5. Set Bundle Identifier to `com.novatrack.teacherhub`
6. Set MARKETING_VERSION to `1.0.0` and CURRENT_PROJECT_VERSION to `1`
7. Run `pod install` in `ios/App/`
8. Archive → Distribute App → App Store Connect
9. Fill out App Store Connect listing using metadata above
10. Submit for review

OR: push a `v1.0.0` tag to trigger the GitHub Actions workflow automatically.
