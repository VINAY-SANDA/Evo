import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/Auth/LoginPage';
import AppLayout from './components/layout/AppLayout';
import { checkApiHealth, getApiBaseUrl } from './services/api';
const HomePage = lazy(() => import('./pages/Home/HomePage'));
const GoalsPage = lazy(() => import('./pages/Goals/GoalsPage'));
const TasksPage = lazy(() => import('./pages/Tasks/TasksPage'));
const HabitsPage = lazy(() => import('./pages/Habits/HabitsPage'));
const AiChatPage = lazy(() => import('./pages/AI/AiChatPage'));
const FinancePage = lazy(() => import('./pages/Finance/FinancePage'));
const ProgressPage = lazy(() => import('./pages/Progress/ProgressPage'));
const LearningPage = lazy(() => import('./pages/Learning/LearningPage'));
const ProjectsPage = lazy(() => import('./pages/Projects/ProjectsPage'));
const RemindersPage = lazy(() => import('./pages/Reminders/RemindersPage'));
const ReviewsPage = lazy(() => import('./pages/Reviews/ReviewsPage'));
const NotificationsPage = lazy(() => import('./pages/Notifications/NotificationsPage'));
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage'));
const PersonalLibraryPage = lazy(() => import('./pages/PersonalLibrary/PersonalLibraryPage'));

export default function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [startupRetry, setStartupRetry] = useState(0);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let attempts = 0;
    const apiBase = getApiBaseUrl();

    if (!apiBase) {
      setStartupError('The server address is not configured for this EVO deployment.');
      return;
    }

    const waitForBackend = async () => {
      const health = await checkApiHealth();
      if (health.ready) {
        if (!stopped) {
          setStartupError(null);
          setBackendReady(true);
        }
        return;
      }
      attempts += 1;
      if (!stopped) {
        if (attempts >= 6) setStartupError(`${health.message || 'EVO is still starting.'} It will keep checking in the background.`);
        timer = window.setTimeout(() => { void waitForBackend(); }, 2500);
      }
    };

    void waitForBackend();
    return () => {
      stopped = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [startupRetry]);

  if (!backendReady) {
    return (
      <div className="startup-screen" role="status" aria-live="polite">
        {!startupError && <span className="startup-spinner" aria-hidden="true" />}
        <p>{startupError || 'Starting EVO and loading your workspace…'}</p>
        {startupError && <button className="btn btn-secondary" onClick={() => { setStartupError(null); setStartupRetry(value => value + 1); }}>Try again</button>}
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
        <Suspense fallback={<div className="page-loading" role="status">Opening your workspace…</div>}>
        <Routes>
          {/* Public Authentication Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Routes for Vinay only */}
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<HomePage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/habits" element={<HabitsPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/learning" element={<LearningPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/diary" element={<PersonalLibraryPage mode="diary" />} />
            <Route path="/movies" element={<PersonalLibraryPage mode="movies" />} />
            <Route path="/ai" element={<AiChatPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
