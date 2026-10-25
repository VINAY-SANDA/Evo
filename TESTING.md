# EVO local testing

## Automated checks

Run from the project folder:

```powershell
npm test
npm run build:all
```

`npm test` builds the backend and runs the authenticated HTTP journeys, session and access checks, and MCP tool checks. The HTTP journeys cover sign-in and session verification; dashboard and AI; memories; goals and milestones; tasks; habits; income, expenses, and savings; learning subjects and topics; projects and milestones; reminders; notifications; progress; daily and weekly reviews; and the user profile. The MCP check calls every registered tool.

The HTTP journeys replace database queries with test fixtures. They exercise the real Express app without reading or changing the configured database. They do not verify persistence against PostgreSQL or visually inspect the pages in a browser.

## Browser usability checklist

Start the backend and frontend in two PowerShell windows from the project folder:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

Then open `http://localhost:5173` and check each flow:

- [ ] Sign in with `vinay@example.com` and `Vinay@2026`; confirm the dashboard opens.
- [ ] Try an incorrect passcode; confirm a clear error appears and the app stays signed out.
- [ ] Refresh while signed in; confirm the session is restored. Sign out; confirm a protected page returns to sign-in.
- [ ] Dashboard: check that summary cards and today's tasks load; use the primary navigation to open each page.
- [ ] Goals: add a goal, update its progress, add and toggle a milestone, then remove the test goal.
- [ ] Tasks: add a task, mark it complete, confirm it appears correctly in the Today view, then remove it.
- [ ] Habits: add a habit, mark today's completion, check the streak/status, archive and restore it, then delete a disposable test habit.
- [ ] Finance: add an expense, income, and savings goal; confirm totals and lists update, then delete each disposable test entry and confirm totals update.
- [ ] Learning: add a track and topic, change the topic status/time, delete the topic, then delete the test track.
- [ ] Projects: add a project, add a milestone, and toggle its completion.
- [ ] Reminders: add, edit, and remove a reminder.
- [ ] Notifications: mark one notification read, use mark-all-read, and remove a notification.
- [ ] Progress: confirm score/summary content loads. Reviews: open daily and weekly views and save a review.
- [ ] AI: send a message and confirm a response appears. Settings: change the AI tone and confirm it remains after revisiting the page.
- [ ] Resize to a narrow window; confirm the navigation, forms, cards, and page content remain usable.

Use clearly named test entries and remove them where the page supports deletion. The browser checklist requires the backend database to be available for data changes to persist.

## Check run on 2026-10-26

- `npm test`: 19 checks passed, including Gemini overload failover and busy-response handling.
- `npm run build:all`: backend and frontend builds passed.
- Local sign-in and session verification succeeded with the configured passcode.
- The dashboard, goals, tasks, habits, finance, learning, projects, progress, reminders, reviews, AI, notifications, and settings pages opened in the local browser.
- Twenty authenticated, read-only API endpoints returned HTTP 200. No live create/update/delete requests were sent.
- The dashboard summary card overflowed at the narrow browser width; its mobile layout was corrected and rechecked visually.
- Create/update/delete behavior was exercised through the isolated automated API fixtures. Persistence writes against the configured database were not run.
- Finance expense/income/savings deletion and habit deletion were verified with owner-scoped requests and foreign-record not-found cases.
- Learning Track, expense, income, savings goal, and habit archive controls were opened in the browser; forms were closed without submitting test records.
