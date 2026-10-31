import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import LoginPage from './pages/Auth/LoginPage';
import AppLayout from './components/layout/AppLayout';
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
