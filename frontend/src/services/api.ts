import type {
  Goal,
  Milestone,
  Task,
  Habit,
  Expense,
  Income,
  SavingsGoal,
  FinanceBudget,
  SavingsContribution,
  StudySession,
  LearningSubject,
  LearningTopic,
  Project,
  ProjectMilestone,
  Reminder,
  Notification,
  DailyReview,
  WeeklyReview,
  ProgressScore,
  User,
  Memory,
  AiMessage,
  DiaryEntry,
  MovieReview,
} from '../types';
import { getAuthToken } from './authStorage';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, '')
  : isLocalhost
    ? 'http://localhost:5000'
    : '';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}, timeoutMs = 0): Promise<T | null> {
  if (!API_BASE_URL) {
    console.error(
      `[EVO API ERROR] VITE_API_URL is missing! Cannot call ${endpoint}.\n` +
      `Please add VITE_API_URL (e.g. https://your-backend.onrender.com) to your Vercel Environment Variables and redeploy.`
    );
    return null;
  }

  const token = typeof window !== 'undefined' ? getAuthToken() : null;
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const url = `${API_BASE_URL}${endpoint}`;
  const timeoutController = timeoutMs > 0 ? new AbortController() : undefined;
  const timeoutId = timeoutController && typeof window !== 'undefined'
    ? window.setTimeout(() => timeoutController.abort(), timeoutMs)
    : undefined;
  try {
    const res = await fetch(url, {
      ...options,
      signal: options.signal ?? timeoutController?.signal,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[EVO API Error ${res.status}] ${url}:`, errText);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    if (timeoutController?.signal.aborted) {
      console.error(`[EVO API Timeout] ${endpoint} did not respond within ${timeoutMs}ms.`);
      return null;
    }
    console.error(`[EVO Network/CORS Error] Failed to fetch ${url}:`, err);
    return null;
  } finally {
    if (timeoutId !== undefined && typeof window !== 'undefined') window.clearTimeout(timeoutId);
  }
}

async function apiDelete(endpoint: string): Promise<boolean> {
  if (!API_BASE_URL) return false;
  const token = typeof window !== 'undefined' ? getAuthToken() : null;
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    return response.ok;
  } catch (error) {
    console.error(`[EVO Network/CORS Error] Failed to delete ${endpoint}:`, error);
    return false;
  }
}

// ── Health ──
export async function checkBackendHealth(): Promise<boolean> {
  const res = await apiRequest<{ status: string }>('/api/health');
  return res?.status === 'online';
}

// ── Dashboard ──
export async function getDashboardData() {
  const remote = await apiRequest<{
    user: User;
    overallScore: number;
    weeklyChange: number;
    todayStats: {
      tasksCompleted: number;
      totalTasks: number;
      habitsCompleted: number;
      totalHabits: number;
      todaySpend: number;
    };
    topStreaks: Array<{ name: string; streak: number; icon: string }>;
    aiInsight: string;
  }>('/api/dashboard');

  if (remote) return remote;

  return {
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Vinay',
      email: 'vinay@example.com',
      timezone: 'Asia/Kolkata',
      aiTone: 'rigorous' as const,
    },
    overallScore: 75,
    weeklyChange: 0,
    todayStats: {
      tasksCompleted: 0,
      totalTasks: 0,
      habitsCompleted: 0,
      totalHabits: 0,
      todaySpend: 0,
    },
    topStreaks: [],
    aiInsight: 'Welcome to EVO. Connect your tasks and habits to track live productivity.',
  };
}

// ── Goals ──
export async function getGoals(): Promise<Goal[]> {
  const remote = await apiRequest<{ goals: Goal[] }>('/api/goals');
  return remote?.goals || [];
}

export async function createGoal(goal: Partial<Goal>): Promise<Goal | null> {
  return await apiRequest<Goal>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(goal),
  });
}

export async function updateGoal(id: string, goal: Partial<Goal>): Promise<Goal | null> {
  return await apiRequest<Goal>(`/api/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(goal),
  });
}

export async function updateGoalProgress(id: string, progress: number): Promise<Goal | null> {
  return await apiRequest<Goal>(`/api/goals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ progress }),
  });
}

export async function recordGoalCheckIn(id: string, currentValue: number, note = ''): Promise<{ currentValue: number } | null> {
  return apiRequest<{ currentValue: number }>(`/api/goals/${id}/check-ins`, { method: 'POST', body: JSON.stringify({ currentValue, note }) });
}

export async function deleteGoal(id: string): Promise<boolean> {
  const token = typeof window !== 'undefined' ? getAuthToken() : null;
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (!API_BASE_URL) return true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/goals/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders },
    });
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

export async function getGoalMilestones(goalId: string): Promise<Milestone[]> {
  const remote = await apiRequest<{ milestones: Milestone[] }>(`/api/goals/${goalId}/milestones`);
  return remote?.milestones || [];
}

export async function createGoalMilestone(goalId: string, milestone: Partial<Milestone>): Promise<Milestone | null> {
  return await apiRequest<Milestone>(`/api/goals/${goalId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(milestone),
  });
}

export async function toggleGoalMilestone(milestoneId: string): Promise<Milestone | null> {
  return await apiRequest<Milestone>(`/api/goals/milestones/${milestoneId}/toggle`, {
    method: 'PATCH',
  });
}

// ── Tasks ──
export async function getTasks(): Promise<Task[]> {
  const remote = await apiRequest<{ tasks: Task[] }>('/api/tasks');
  return remote?.tasks || [];
}

export async function getTodayTasks(): Promise<Task[]> {
  const remote = await apiRequest<{ tasks: Task[] }>('/api/tasks/today');
  return remote?.tasks || [];
}

export async function createTask(task: Partial<Task>): Promise<Task | null> {
  return await apiRequest<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export async function toggleTaskStatus(id: string): Promise<Task | null> {
  return await apiRequest<Task>(`/api/tasks/${id}/toggle`, { method: 'POST' });
}

export async function deleteTask(id: string): Promise<boolean> {
  const token = typeof window !== 'undefined' ? getAuthToken() : null;
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (!API_BASE_URL) return true;
  try {
    const res = await fetch(`${API_BASE_URL}/api/tasks/${id}`, {
      method: 'DELETE',
      headers: { ...authHeaders },
    });
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

// ── Habits ──
export async function getHabits(includeArchived = false): Promise<Habit[]> {
  const suffix = includeArchived ? '?includeArchived=true' : '';
  const remote = await apiRequest<{ habits: Habit[] }>(`/api/habits${suffix}`);
  return remote?.habits || [];
}

export async function getHabitWeeklySummary(): Promise<{ habits: Array<{ id: string; name: string; icon: string; currentStreak: number; completedDays: number }>; completed: number; expected: number; completionRate: number }> {
  return (await apiRequest<any>('/api/habits/summary/weekly')) || { habits: [], completed: 0, expected: 0, completionRate: 0 };
}

export async function createHabit(habit: Partial<Habit>): Promise<Habit | null> {
  return await apiRequest<Habit>('/api/habits', {
    method: 'POST',
    body: JSON.stringify(habit),
  });
}

export async function toggleHabitComplete(id: string): Promise<Habit | null> {
  return await apiRequest<Habit>(`/api/habits/${id}/complete`, { method: 'POST' });
}

export async function archiveHabit(id: string): Promise<Habit | null> {
  return await apiRequest<Habit>(`/api/habits/${id}/archive`, { method: 'PATCH' });
}

export async function restoreHabit(id: string): Promise<Habit | null> {
  return await apiRequest<Habit>(`/api/habits/${id}/restore`, { method: 'PATCH' });
}

export async function deleteHabit(id: string): Promise<boolean> {
  return apiDelete(`/api/habits/${id}`);
}

// ── Finance ──
export async function getFinanceSummary() {
  const remote = await apiRequest<{
    summary?: { totalIncome?: number; totalExpenses?: number; netSavings?: number; savingsRate?: number };
    totalIncome?: number;
    totalExpenses?: number;
    netSavings?: number;
    savingsRate?: number;
    expenses: Expense[];
    income: any[];
    savingsGoals: any[];
  }>('/api/finance/summary');

  if (remote) {
    return {
      totalIncome: remote.summary?.totalIncome ?? remote.totalIncome ?? 0,
      totalExpenses: remote.summary?.totalExpenses ?? remote.totalExpenses ?? 0,
      netSavings: remote.summary?.netSavings ?? remote.netSavings ?? 0,
      savingsRate: remote.summary?.savingsRate ?? remote.savingsRate ?? 0,
      expenses: remote.expenses || [],
      income: remote.income || [],
      savingsGoals: remote.savingsGoals || [],
    };
  }

  return {
    totalIncome: 0,
    totalExpenses: 0,
    netSavings: 0,
    expenses: [],
    income: [],
    savingsGoals: [],
  };
}

export async function addExpense(expense: Partial<Expense>): Promise<Expense | null> {
  return await apiRequest<Expense>('/api/finance/expenses', {
    method: 'POST',
    body: JSON.stringify(expense),
  });
}

export async function addIncome(income: Partial<Income>): Promise<Income | null> {
  return await apiRequest<Income>('/api/finance/income', {
    method: 'POST',
    body: JSON.stringify(income),
  });
}

export async function addSavingsGoal(goal: Partial<SavingsGoal>): Promise<SavingsGoal | null> {
  return await apiRequest<SavingsGoal>('/api/finance/savings', {
    method: 'POST',
    body: JSON.stringify(goal),
  });
}

export async function deleteExpense(id: string): Promise<boolean> {
  return apiDelete(`/api/finance/expenses/${id}`);
}

export async function deleteIncome(id: string): Promise<boolean> {
  return apiDelete(`/api/finance/income/${id}`);
}

export async function deleteSavingsGoal(id: string): Promise<boolean> {
  return apiDelete(`/api/finance/savings/${id}`);
}

export async function getFinanceBudgets(month: string): Promise<FinanceBudget[]> {
  const remote = await apiRequest<{ budgets: FinanceBudget[] }>(`/api/finance/budgets?month=${encodeURIComponent(month)}`);
  return remote?.budgets || [];
}

export async function saveFinanceBudget(budget: { category: string; month: string; limitAmount: number; alertPercent?: number }): Promise<FinanceBudget | null> {
  return apiRequest<FinanceBudget>('/api/finance/budgets', { method: 'PUT', body: JSON.stringify(budget) });
}

export async function deleteFinanceBudget(id: string): Promise<boolean> {
  return apiDelete(`/api/finance/budgets/${id}`);
}

export async function addSavingsContribution(goalId: string, contribution: { amount: number; date?: string; note?: string }): Promise<SavingsContribution & { currentAmount: number }> {
  const result = await apiRequest<SavingsContribution & { currentAmount: number }>(`/api/finance/savings/${goalId}/contributions`, { method: 'POST', body: JSON.stringify(contribution) });
  if (!result) throw new Error('The savings contribution was not saved.');
  return result;
}

export async function getSavingsContributions(goalId: string): Promise<SavingsContribution[]> {
  const result = await apiRequest<{ contributions: SavingsContribution[] }>(`/api/finance/savings/${goalId}/contributions`);
  return result?.contributions || [];
}

// ── Learning ──
export async function getLearningSubjects(): Promise<LearningSubject[]> {
  const remote = await apiRequest<{ subjects: LearningSubject[] }>('/api/learning/subjects');
  return remote?.subjects || [];
}

export async function getLearningSubjectsWithStatus(): Promise<{ subjects: LearningSubject[]; ok: boolean }> {
  const remote = await apiRequest<{ subjects: LearningSubject[] }>('/api/learning/subjects');
  return { subjects: remote?.subjects || [], ok: remote !== null };
}

export async function getLearningDaysWorked(): Promise<number | null> {
  const result = await apiRequest<{ daysWorked: number }>('/api/learning/stats');
  return result ? Number(result.daysWorked) || 0 : null;
}

export async function getLearningTopics(subjectId?: string): Promise<LearningTopic[]> {
  if (!subjectId) return [];
  const url = `/api/learning/subjects/${subjectId}/topics`;
  const remote = await apiRequest<{ topics: LearningTopic[] }>(url);
  return remote?.topics || [];
}

export async function getLearningTopicsWithStatus(subjectId?: string): Promise<{ topics: LearningTopic[]; ok: boolean }> {
  if (!subjectId) return { topics: [], ok: true };
  const remote = await apiRequest<{ topics: LearningTopic[] }>(`/api/learning/subjects/${subjectId}/topics`);
  return { topics: remote?.topics || [], ok: remote !== null };
}

export async function createLearningSubject(subject: Partial<LearningSubject>): Promise<LearningSubject | null> {
  return await apiRequest<LearningSubject>('/api/learning/subjects', {
    method: 'POST',
    body: JSON.stringify(subject),
  });
}

export async function deleteLearningSubject(id: string): Promise<boolean> {
  return apiDelete(`/api/learning/subjects/${id}`);
}

export async function createTopic(subjectId: string, topic: Partial<LearningTopic> & { resourceUrl?: string; nextReviewDate?: string }): Promise<LearningTopic | null> {
  return await apiRequest<LearningTopic>(`/api/learning/subjects/${subjectId}/topics`, {
    method: 'POST',
    body: JSON.stringify(topic),
  });
}

export async function updateLearningTopic(id: string, topic: Partial<LearningTopic> & { resourceUrl?: string; nextReviewDate?: string | null }): Promise<LearningTopic | null> {
  return apiRequest<LearningTopic>(`/api/learning/topics/${id}`, { method: 'PATCH', body: JSON.stringify(topic) });
}

export async function updateTopicStatus(id: string, status: string): Promise<LearningTopic | null> {
  return await apiRequest<LearningTopic>(`/api/learning/topics/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function deleteLearningTopic(id: string): Promise<boolean> {
  return apiDelete(`/api/learning/topics/${id}`);
}

export async function logStudySession(session: { subjectId: string; topicId?: string; durationMinutes: number; note?: string }): Promise<StudySession | null> {
  return apiRequest<StudySession>('/api/learning/study-sessions', { method: 'POST', body: JSON.stringify(session) });
}

export async function getStudySessions(subjectId?: string): Promise<StudySession[]> {
  const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : '';
  const result = await apiRequest<{ sessions: StudySession[] }>(`/api/learning/study-sessions${query}`);
  return result?.sessions || [];
}

// ── Projects ──
export async function getProjects(): Promise<Project[]> {
  const remote = await apiRequest<{ projects: Project[] }>('/api/projects');
  return remote?.projects || [];
}

export async function createProject(project: Partial<Project>): Promise<Project | null> {
  return await apiRequest<Project>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  });
}

export async function updateProject(id: string, project: Partial<Project>): Promise<Project | null> {
  return apiRequest<Project>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(project) });
}

export async function deleteProject(id: string): Promise<boolean> {
  return apiDelete(`/api/projects/${id}`);
}

export async function createProjectMilestone(projectId: string, milestone: Partial<ProjectMilestone>): Promise<ProjectMilestone | null> {
  return await apiRequest<ProjectMilestone>(`/api/projects/${projectId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(milestone),
  });
}

export async function getProjectMilestones(projectId: string): Promise<ProjectMilestone[]> {
  const remote = await apiRequest<{ milestones: ProjectMilestone[] }>(`/api/projects/${projectId}/milestones`);
  return remote?.milestones || [];
}

export async function toggleProjectMilestone(id: string): Promise<ProjectMilestone | null> {
  return await apiRequest<ProjectMilestone>(`/api/projects/milestones/${id}/toggle`, {
    method: 'PATCH',
  });
}

export async function deleteProjectMilestone(id: string): Promise<boolean> {
  return apiDelete(`/api/projects/milestones/${id}`);
}

// ── Reminders ──
export async function getReminders(): Promise<Reminder[]> {
  const remote = await apiRequest<{ reminders: Reminder[] }>('/api/reminders');
  return remote?.reminders || [];
}

export async function createReminder(reminder: Partial<Reminder>): Promise<Reminder | null> {
  return await apiRequest<Reminder>('/api/reminders', {
    method: 'POST',
    body: JSON.stringify(reminder),
  });
}

export async function updateReminder(id: string, reminder: Partial<Reminder>): Promise<Reminder | null> {
  return apiRequest<Reminder>(`/api/reminders/${id}`, { method: 'PATCH', body: JSON.stringify(reminder) });
}

export async function deleteReminder(id: string): Promise<boolean> {
  return apiDelete(`/api/reminders/${id}`);
}

// ── Notifications ──
export async function getNotifications(): Promise<Notification[]> {
  const remote = await apiRequest<{ notifications: Notification[] }>('/api/notifications');
  return remote?.notifications || [];
}

export async function markNotificationAsRead(id: string): Promise<boolean> {
  const res = await apiRequest<{ ok: boolean }>(`/api/notifications/${id}/read`, { method: 'PATCH' });
  return res?.ok ?? true;
}

// ── Progress & Reviews ──
export async function getProgressScores(): Promise<ProgressScore[]> {
  const remote = await apiRequest<{ scores: ProgressScore[] }>('/api/progress/scores');
  return remote?.scores || [];
}

export async function getDailyReview(): Promise<DailyReview | null> {
  const remote = await apiRequest<{ reviews: DailyReview[]; latest: DailyReview | null }>('/api/reviews/daily');
  return remote?.latest || null;
}

export async function getWeeklyReview(): Promise<WeeklyReview | null> {
  const remote = await apiRequest<{ reviews: WeeklyReview[]; latest: WeeklyReview | null }>('/api/reviews/weekly');
  return remote?.latest || null;
}

export async function saveDailyReview(review: Partial<DailyReview>): Promise<DailyReview | null> {
  return await apiRequest<DailyReview>('/api/reviews/daily', {
    method: 'POST',
    body: JSON.stringify(review),
  });
}

export async function saveWeeklyReview(review: Partial<WeeklyReview>): Promise<WeeklyReview | null> {
  return apiRequest<WeeklyReview>('/api/reviews/weekly', { method: 'POST', body: JSON.stringify(review) });
}

export async function getDiaryEntries(): Promise<DiaryEntry[] | null> {
  const result = await apiRequest<{ entries: DiaryEntry[] }>('/api/library/diary');
  return result?.entries ?? null;
}

export async function createDiaryEntry(entry: Pick<DiaryEntry, 'title' | 'body' | 'date'>): Promise<DiaryEntry | null> {
  return apiRequest<DiaryEntry>('/api/library/diary', { method: 'POST', body: JSON.stringify(entry) });
}

export async function deleteDiaryEntry(id: string): Promise<boolean> {
  return apiDelete(`/api/library/diary/${id}`);
}

export async function getMovieReviews(): Promise<MovieReview[] | null> {
  const result = await apiRequest<{ entries: MovieReview[] }>('/api/library/movies');
  return result?.entries ?? null;
}

export async function createMovieReview(entry: Pick<MovieReview, 'title' | 'year' | 'rating' | 'review' | 'watchedAt'>): Promise<MovieReview | null> {
  return apiRequest<MovieReview>('/api/library/movies', { method: 'POST', body: JSON.stringify(entry) });
}

export async function deleteMovieReview(id: string): Promise<boolean> {
  return apiDelete(`/api/library/movies/${id}`);
}

// ── AI Conversation ──
export async function sendAiChatMessage(message: string, context?: any): Promise<AiMessage> {
  const remote = await apiRequest<{
    id: string;
    role: 'assistant';
    content: string;
    actions?: Array<{ id: string; label: string; type: 'primary' | 'secondary'; action: string }>;
    timestamp: string;
  }>('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message, context }),
  }, 28000);

  if (remote) {
    return {
      id: remote.id,
      role: 'assistant',
      content: remote.content,
      actions: remote.actions,
      timestamp: remote.timestamp,
    };
  }

  return {
    id: `msg_${Date.now()}_ai`,
    role: 'assistant',
    content: 'EVO could not get an AI response in time. Check that the backend and Gemini API are available, then try again.',
    timestamp: new Date().toISOString(),
  };
}

// ── User & Settings ──
export async function getUserProfile(): Promise<User> {
  const remote = await apiRequest<User>('/api/user/profile');
  return remote || {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Vinay',
    email: 'vinay@example.com',
    timezone: 'Asia/Kolkata',
    aiTone: 'rigorous',
  };
}

export async function updateUserProfile(profile: Partial<User>): Promise<User> {
  const remote = await apiRequest<User>('/api/user/profile', {
    method: 'PATCH',
    body: JSON.stringify(profile),
  });
  return remote || {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Vinay',
    email: 'vinay@example.com',
    timezone: 'Asia/Kolkata',
    aiTone: 'rigorous',
    ...profile,
  };
}

export async function getMemories(): Promise<Memory[]> {
  const remote = await apiRequest<{ memories: Array<Memory & { type?: string }> }>('/api/memories');
  return (remote?.memories || []).map(memory => ({
    ...memory,
    memoryType: memory.memoryType || memory.type || 'preference',
    importance: Number(memory.importance) || 7,
  }));
}

export async function addMemory(text: string, type: string = 'preference', importance: number = 7): Promise<Memory | null> {
  const saved = await apiRequest<Memory & { type?: string }>('/api/memories', {
    method: 'POST',
    body: JSON.stringify({ text, type, importance }),
  });
  return saved ? { ...saved, memoryType: saved.memoryType || saved.type || type } : null;
}
