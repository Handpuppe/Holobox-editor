# Architecture

## Overview

Holobox Speech Therapy is a client-side React SPA. It is composed at **1080 × 1920** (9:16) and scaled proportionally inside a white Holobox shell.

There is no backend, no analytics, and no required network call after the files are served.

## Routing

`BrowserRouter` maps Dutch educational screens:

| Path                   | Screen                          |
| ---------------------- | ------------------------------- |
| `/`                    | Home                            |
| `/briefing`            | Scenario + learning objectives  |
| `/simulatie`           | Intake simulation               |
| `/conclusie`           | Preliminary clinical conclusion |
| `/resultaat`           | Current result                  |
| `/resultaat/:resultId` | Saved result                    |
| `/geschiedenis`        | Previous results                |
| `/over`                | About, privacy, disclaimer      |
| `/laden`               | Loading state                   |
| `/storing`             | Error state                     |
| `*`                    | Unknown route recovery          |

## Scenario data

Scenario copy, branching, client reactions, delayed feedback and scoring live in `src/data/aphasiaIntakeScenario.ts`. UI components do not embed the rubric.

Startup validation is in `src/domain/scenarioValidation.ts`. An invalid scenario shows the error screen.

## Simulation state

`src/state/simulationReducer.ts` is a deterministic state machine:

- select option → client reaction + lock
- complete transition → next node or conclusion
- pause / resume / early end / notes / conclusion

`AppStateProvider` persists the unfinished session after every change.

## Scoring

`src/domain/scoring.ts` computes competency percents from explicit awards (0 / 0.5 / 1), then a weighted total rounded to 0–100.

Weights:

- adapted communication 30%
- history taking and client goals 25%
- observation 15%
- clinical reasoning 15%
- empathy and professional behaviour 15%

Free-text conclusion fields are stored and sanitised but never scored.

## Persistence

`src/storage/storageService.ts` wraps `localStorage` with:

- schema version `1`
- JSON parse guards
- unsupported-schema rejection
- corrupted-payload fallback
- null-storage fallback when `localStorage` is blocked

## UI

Portrait layout: virtual client at the top, response in the middle, three equally styled options at the bottom. CSS is in `src/styles/global.css`. The page background is always `#FFFFFF`.

## Testing

- Vitest + Testing Library: scoring, branching, storage, UI flow
- Playwright: 1080×1920 Chromium, a11y, white-background, screenshots
