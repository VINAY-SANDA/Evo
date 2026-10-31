# EVO Project Review: Startup, Visual Design, and Core Workflows

**Prepared:** 31 October 2026  
**Scope:** Read-only review of the current frontend and backend. This document is the review deliverable before implementation.

## Executive summary

EVO has working foundations for learning sessions, projects, reminders, and daily/weekly reviews, but the user experience is inconsistent because some screen actions only change browser state while others save to the API. The slow first screen after returning to the app is most likely the saved-session verification waiting for the backend; if the deployed Render service is on its free plan, waking from idle can add a cold-start delay. The current loading view gives no useful progress or recovery action.

The design system is mostly token-based, but green status surfaces, pale green selected states, and hard-coded light colors sit alongside dark theme tokens. This can create low contrast or inconsistent components. A single accessible palette and explicit light/dark surface rules should be applied across all pages.

## Findings

### 1. App startup and loading

- `frontend/src/context/AuthContext.tsx` starts in a loading state and awaits `/api/auth/verify` before allowing protected pages to render. That request has no timeout, so a sleeping, slow, or unreachable backend can leave the app on the verification screen.
- `render.yaml` configures the backend with `plan: free`. A free hosted service can sleep while idle and take time to wake. This is a likely cause of intermittent slow loads, but actual timing needs to be measured in the deployed environment.
- `frontend/src/components/auth/ProtectedRoute.tsx` displays “Verifying biometric security credential...” even though the code performs a normal server session check. The screen has no retry or explanation of a network delay.
- `frontend/src/App.tsx` imports every page eagerly. This increases the initial JavaScript bundle and work before any destination is opened. Route-level lazy loading is a sensible follow-up, especially as pages grow.
- The API helper in `frontend/src/services/api.ts` uses no timeout by default. A failed request can appear as an empty page because the helper returns `null` and many page callers convert that to an empty list.

**Recommended user experience:** show the app shell immediately when a locally stored session exists, verify in the background, and handle invalid sessions cleanly. Add a bounded verification timeout, a clear connection/retry state, and loading/empty/error states for data screens. Measure browser startup time and backend response time separately before deciding whether hosting changes are needed.

### 2. Typography and color contrast

- `frontend/src/index.css` defines a dark surface palette and shared text tokens, while feature styles include hard-coded light green surfaces such as `#e8f1eb` and `#dceee1`. If those rules appear in the dark theme, they can conflict with the surrounding text and card colors.
- Success colors are reused for both text and backgrounds. For example, learning and review states combine translucent green surfaces with shared success text. Green-on-green contrast should be checked in the rendered UI, especially for small labels.
- `frontend/src/pages/Reminders/RemindersPage.css` includes a white toggle knob (`#fff`) while the rest of the design is theme-token based. Other page-specific hard-coded colors also make theme consistency harder to maintain.
- The typography is centrally based on `--font-sans`; the primary issue found in code is color/surface consistency rather than a specific font-family mismatch. Text size, weight, line-height, and muted text contrast should still be reviewed together on the actual screens.

**Recommended design direction:** keep the EVO dark surface palette, use green as a restrained success accent, and pair it with a substantially darker or lighter text color rather than green text on a green surface. Define semantic tokens for success text, success surface, selected surface, primary text, and muted text. Remove page-level light color literals where a token can express the same intent. Verify normal text contrast at 4.5:1 and large text at 3:1; never use color alone to communicate status.

### 3. Learning and focus timer

- Learning already has a 25-minute focus flow, pause/resume, session persistence, a session log, topic status, and a review queue. This is a useful base, but it needs clear states when data cannot be loaded or a session cannot be saved.
- The timer is elapsed-time based and saves a study session when the user chooses “Save session.” It should clearly explain whether it is a count-up focus sprint or a countdown, keep time accurate after tab suspension/reload, and avoid recording a session if the save fails.
- Useful additions: optional short/long focus presets, break timer, session notes, today’s focused time, and a visible link from a completed session to the topic studied. Keep the current simple 25-minute default unless the user changes it.

### 4. Projects

- Project creation, listing, milestone creation, and milestone completion have API support. The visible client API does not expose project edit/delete or milestone delete/reorder operations, making routine project maintenance incomplete.
- `ProjectsPage.tsx` updates milestone state optimistically before checking whether the API update succeeded. The displayed completion/progress can therefore diverge from saved data after a network failure.
- Project templates create a project and then several milestones as separate requests. If a milestone request fails, the user can be left with a partially created template and no clear recovery message.

**Recommended core workflow:** create/edit/archive a project; set an owner (even if initially just the signed-in user), priority, target date, and next action; add, reorder, complete, and remove milestones; show progress and overdue state; surface linked tasks; confirm destructive actions; and show success/error feedback based on server results.

### 5. Reminders

- The backend supports reminder create, edit, toggle through `PATCH`, delete, active state, repeat type, time, weekdays, and optional goal link.
- The frontend `api.ts` currently exposes only reminder list and create operations. `RemindersPage.tsx` toggles `active` in local React state only, so that change is not saved and will revert after refresh. There is no UI path for editing or deleting reminders.
- The UI labels scheduled reminders, but there is no browser notification permission flow or delivery mechanism visible in the frontend. Saving a reminder should not imply that an alarm will fire unless a delivery channel is implemented and explained.

**Recommended core workflow:** create, edit, pause/resume, and delete; choose repeat days and timezone; show the next scheduled occurrence; link to a goal/task; offer snooze and mark-done actions if notifications are delivered; explain notification permission and delivery limits; and show a save failure without silently changing the displayed state.

### 6. Reviews

- Daily and weekly review read/write endpoints exist. The page supports adding a daily reflection and generating a weekly review with Gemini.
- `ReviewsPage.tsx` updates daily review state before the save result is known. The UI can look saved when the API call failed. Some review-to-task actions also await task creation without clear feedback based on whether the task was actually created.
- The page fetches reviews but the available API functions return only the latest review, limiting review history and comparison.
- Gemini generation depends on several network calls and has a spinner, but users should be able to distinguish a generation error from a save error and retain their draft if either step fails.

**Recommended core workflow:** guided daily reflection with task/habit summary, wins, blockers, mood/energy, and one next action; weekly review with goals, category trends, achievements, lessons, and a small set of next-week priorities; editable drafts; explicit save state; review history; and a retry path that preserves entered text.

## Suggested order of work

1. **P0 — Make saves trustworthy:** persist reminder toggles, report save failures, and avoid showing optimistic changes as saved when requests fail.
2. **P0 — Fix the startup wait:** measure auth verification and API response timing; add a timeout and useful retry state; inspect deployed backend wake-up behavior.
3. **P1 — Restore complete workflows:** add edit/delete support for projects and reminders, robust milestone/template failure handling, and review draft/save states.
4. **P1 — Unify visual tokens:** audit green-on-green and hard-coded backgrounds, then verify contrast across all pages and interaction states.
5. **P2 — Improve perceived performance:** lazy-load page routes and defer nonessential page data; compare bundle size and first-render timing before and after.
6. **P2 — Refine learning/review value:** add timer presets/breaks and richer daily/weekly review history after core persistence is reliable.

## How to verify the diagnosis

- Record the duration of `/api/auth/verify` and the first data request on a cold visit and a warm visit.
- Compare frontend render time with backend response time using browser developer tools.
- Test a signed-in visit with the backend unavailable, delayed, and responsive.
- In the UI, toggle a reminder, reload, and confirm the saved state; complete a project milestone and simulate a failed request; save a review with the API unavailable and confirm the draft remains visible.
- Review representative pages in the actual theme at normal zoom and keyboard focus, then measure text/background contrast for the smallest labels and controls.

## Files reviewed

- `frontend/src/App.tsx`, `frontend/src/context/AuthContext.tsx`, `frontend/src/components/auth/ProtectedRoute.tsx`
- `frontend/src/index.css`, and the Learning, Projects, Reminders, and Reviews page components/styles
- `frontend/src/services/api.ts`
- Corresponding backend routes for Learning, Projects, Reminders, and Reviews
- `render.yaml` and project package configuration

This is a code-based review, not a visual browser inspection or a measured production performance trace. The recommendations should be validated against the running app before implementation.

## User-requested additions

- Use a consistently white/light page background and remove black/dark panels; keep text dark and readable with green used only as an accent.
- On Learning, show completed topic counts and how many distinct days the user studied, in addition to time studied.
- Add a Diary area for personal entries.
- Add a Movies area to record movies and personal reviews/ratings.

## Implementation status

- Completed: white page surfaces, including the previously dark Progress hero and Learning focus panel; Learning completed-topic and all-time study-day totals; route-level page loading; cached-session-first startup with a bounded server check; persistent Diary and Movies entry creation/listing/deletion; project editing/deletion and milestone deletion with server-confirmed state; persisted reminder pause/edit/delete, weekday selection, one-time date, and browser alerts; review save-failure handling.
- Reminder delivery uses browser notifications while EVO is open. It does not schedule alerts when the browser is closed; that requires a server push or installed-app notification service.
- The database migration for Diary, Movies, and one-time reminder dates runs through the existing additive startup migration. Existing browser-only entries, if any, are not automatically migrated.
