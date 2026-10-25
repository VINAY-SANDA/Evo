import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import HomePage from './pages/Home/HomePage';
import GoalsPage from './pages/Goals/GoalsPage';
import TasksPage from './pages/Tasks/TasksPage';
import HabitsPage from './pages/Habits/HabitsPage';
import AiChatPage from './pages/AI/AiChatPage';
import FinancePage from './pages/Finance/FinancePage';
import ProgressPage from './pages/Progress/ProgressPage';
import LearningPage from './pages/Learning/LearningPage';
import ProjectsPage from './pages/Projects/ProjectsPage';
import RemindersPage from './pages/Reminders/RemindersPage';
import ReviewsPage from './pages/Reviews/ReviewsPage';
import NotificationsPage from './pages/Notifications/NotificationsPage';
import SettingsPage from './pages/Settings/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
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
          <Route path="/ai" element={<AiChatPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
