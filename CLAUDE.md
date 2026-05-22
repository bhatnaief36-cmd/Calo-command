# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Calo Command Center** is a single-page onboarding management PWA for the Calo Group (food delivery/logistics). It tracks new-hire candidates through 7 training stages (Pre-Boarding → Orientation → HR Compliance → Quality Standards → OJT Training → Assessment → Certification) across 8 geographic markets (UAE, Qatar, Kuwait, Bahrain, Riyadh, Jeddah, Oman, UK).

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Alpine.js v2.3.0 (CDN), plain CSS |
| Backend | Google Apps Script (GAS) web app |
| Database | Google Sheets |
| API proxy | Vercel serverless (`/api/gas.js`) |
| Hosting | Vercel (static) |
| PWA | `sw.js` + `manifest.json` |

**No build step, no package manager, no test framework, no linter.** This is a static HTML/JS application deployed directly to Vercel.

## Development

There are no npm scripts or build commands. Development is done by editing `index.html` directly and pushing to Vercel.

**Local preview**: Open `index.html` in a browser (note: API calls to `/api/gas` require a Vercel dev environment or a running local server).

**Environment variable**: The serverless proxy at `/api/gas.js` reads `GAS_URL` — the Google Apps Script web app endpoint. This must be set in Vercel project settings.

**Deploy**: Vercel auto-deploys on push. The `vercel.json` rewrites all routes to `index.html` (SPA fallback) except `/api/gas`.

## Architecture

### Single-File Frontend (`index.html`, ~4,760 lines)

The entire application lives in one HTML file structured as:

- **Lines 1–260**: CSS variables, fonts, layout styles, HTML root with `x-data="app()" x-init="init()"`
- **Lines 261–615**: Login form + role-based sidebar navigation
- **Lines 616–2900**: All view HTML using Alpine.js `x-show` conditionals (one block per view per role)
- **Lines 2901–3870**: Modals (employee detail, task manager, new hire form, etc.)
- **Lines 3871–4746**: Alpine.js `app()` function — all reactive state and business logic (~900 lines of JS)
- **Lines 4747–4760**: Service Worker registration

### Data Flow

```
Alpine.js app()
  → gas(action, params)          // single method for all backend calls
  → fetch POST /api/gas          // Vercel serverless proxy
  → Google Apps Script web app   // reads/writes Google Sheets
```

All backend interactions go through the `gas()` method, which POSTs to `/api/gas` with an `action` string and params. Key actions: `checkLogin`, `getPipelineData`, `getTemplateList`, `saveFullUpdate`, `addNewEmployee`, `deleteEmployee`, `updateCandidateField`, `addDynamicUser`.

### State Management

One large `app()` object holds all reactive state (~120 properties). Core data:

```javascript
emps: [{
  row, name, role, country, image, priority, month, year,
  pre: { done, total, items: [{name, link, done}] },
  ori, hr, qual, ojt, assess, cert,   // same structure
  trainers: { pre: {name, img}, qual: {...} },
  stageEntries, stageExits, notes
}]
```

Auxiliary data (materials, trainers, users, announcements, SLA rules) is persisted to **localStorage** under scoped keys:
- `calo_session` — logged-in user context
- `calo_mat_[username]_[dept]` — training materials per user/dept
- `calo_trainers_[market]` — trainers per market
- `calo_l1_users`, `calo_announcements`, `calo_audit`, `calo_sla`

### Role-Based Access

Four role levels with distinct views and capabilities:

| Level | Role | Key responsibilities |
|---|---|---|
| L1 | Global Admin | Users, announcements, audit log, SLA rules |
| L2 | Regional Training Specialist (RTS) | Multi-market pipeline, trainers, materials, admin (MPs, depts, credentials) |
| L3 | Training Coordinator (TC) | Single-market pipeline, trainers, materials, bulk CSV import |
| L4a | HR Officer | Pre-boarding, orientation, HR compliance stages |
| L4b | Quality Trainer | Quality training stage |
| L4c | OJT/Assessment Trainer | *(Placeholder — marked "build later")* |
| L4d | Department Manager (DM) | OJT, assessment, certification stages |

Active view is tracked via `v` property (e.g., `v='dash'`, `v='pipe'`, `v='hr_pipe'`). Stage edit access is guarded by the `acc(emp, key)` method which checks `mlevel` and `mdept`.

### Key Patterns

- **Optimistic UI**: local state updates immediately; backend sync is async in background
- **Flash notifications**: `dofl()` shows a 3-second overlay on successful actions
- **Filtered pipelines**: `filtered()`, `rtsFiltered()`, `tcFiltered()`, `hrFiltered()`, `qualFiltered()`, `dmFiltered()` — each returns the candidate list scoped to the current user's market/dept/search
- **Stage progress**: each stage object has `done`/`total` counts and an `items` array of tasks with individual `done` booleans

### API Proxy (`/api/gas.js`)

A 38-line Vercel Node.js serverless function that validates the POST request, reads `process.env.GAS_URL`, proxies the JSON body to GAS, and returns the response with `Cache-Control: no-store`.
