import type {
  Goal,
  Task,
  Habit,
  Expense,
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
} from '../types';

const rawApiUrl = (import.meta.env.VITE_API_URL || '').trim();
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
const API_BASE_URL = rawApiUrl
  ? rawApiUrl.replace(/\/+$/, '')
  : isLocalhost
    ? 'http://localhost:5000'
    : '';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T | null> {
  if (!API_BASE_URL) {
    console.error(
      `[EVO API ERROR] VITE_API_URL is missing! Cannot call ${endpoint}.\n` +
      `Please add VITE_API_URL (e.g. https://your-backend.onrender.com) to your Vercel Environment Variables and redeploy.`
    );
    return null;
  }

  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
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
    console.error(`[EVO Network/CORS Error] Failed to fetch ${url}:`, err);
    return null;
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

// ── Tasks ──
export async function getTasks(): Promise<Task[]> {
  const remote = await apiRequest<{ tasks: Task[] }>('/api/tasks');
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

// ── Habits ──
export async function getHabits(): Promise<Habit[]> {
  const remote = await apiRequest<{ habits: Habit[] }>('/api/habits');
  return remote?.habits || [];
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

// ── Finance ──
export async function getFinanceSummary() {
  const remote = await apiRequest<{
    summary: {
      totalIncome: number;
      totalExpenses: number;
      netSavings: number;
      savingsRate: number;
    };
    expenses: Expense[];
    income: any[];
    savingsGoals: any[];
  }>('/api/finance/summary');

  if (remote) {
    return {
      totalIncome: remote.summary?.totalIncome || 0,
      totalExpenses: remote.summary?.totalExpenses || 0,
      netSavings: remote.summary?.netSavings || 0,
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

// ── Learning ──
export async function getLearningSubjects(): Promise<LearningSubject[]> {
  const remote = await apiRequest<{ subjects: LearningSubject[] }>('/api/learning/subjects');
  return remote?.subjects || [];
}

export async function getLearningTopics(subjectId?: string): Promise<LearningTopic[]> {
  const url = subjectId ? `/api/learning/subjects/${subjectId}/topics` : '/api/learning/subjects';
  const remote = await apiRequest<{ topics: LearningTopic[] }>(url);
  return remote?.topics || [];
}

export async function createTopic(subjectId: string, topic: Partial<LearningTopic>): Promise<LearningTopic | null> {
  return await apiRequest<LearningTopic>(`/api/learning/subjects/${subjectId}/topics`, {
    method: 'POST',
    body: JSON.stringify(topic),
  });
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

export async function createProjectMilestone(projectId: string, milestone: Partial<ProjectMilestone>): Promise<ProjectMilestone | null> {
  return await apiRequest<ProjectMilestone>(`/api/projects/${projectId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(milestone),
  });
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
  });

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
    content: `EVO system acknowledged: "${message}". Your execution data is being tracked live in Supabase. Continue focusing on high-leverage milestones.`,
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
  const remote = await apiRequest<{ memories: Memory[] }>('/api/memories');
  return remote?.memories || [];
}

export async function addMemory(text: string, type: string = 'preference', importance: number = 7): Promise<Memory | null> {
  return await apiRequest<Memory>('/api/memories', {
    method: 'POST',
    body: JSON.stringify({ text, type, importance }),
  });
}
