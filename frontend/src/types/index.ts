/* ── Types for EVO Application ── */

// ── Auth ──
export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  timezone?: string;
  aiTone?: 'rigorous' | 'balanced' | 'empathetic';
  createdAt?: string;
}

export type Milestone = GoalMilestone;

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ── Goals ──
export type GoalCategory = 'career' | 'education' | 'finance' | 'health' | 'personal' | 'business' | 'project' | 'other';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: GoalCategory;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string;
  priority: Priority;
  status: GoalStatus;
  progress: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoalMilestone {
  id: string;
  goalId: string;
  title: string;
  description?: string;
  orderIndex: number;
  status: 'pending' | 'completed';
  dueDate?: string;
  completedAt?: string;
}

// ── Tasks ──
export type TaskStatus = 'todo' | 'in_progress' | 'completed' | 'skipped' | 'cancelled';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  dueDate?: string;
  dueTime?: string;
  priority: Priority;
  status: TaskStatus;
  goalId?: string;
  projectId?: string;
  category?: string;
  estimatedMinutes?: number;
  isRecurring: boolean;
  isAiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Habits ──
export type HabitFrequency = 'daily' | 'weekly' | 'custom';

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description?: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  target: number;
  unit: string;
  currentStreak: number;
  longestStreak: number;
  active: boolean;
  completedToday: boolean;
  createdAt: string;
}

export interface HabitLog {
  id: string;
  habitId: string;
  date: string;
  completed: boolean;
  value?: number;
}

// ── Reminders ──
export type ReminderType = 'one_time' | 'daily' | 'weekly' | 'custom';

export interface Reminder {
  id: string;
  userId: string;
  title: string;
  description?: string;
  type: ReminderType;
  time: string;
  daysOfWeek?: number[];
  active: boolean;
  goalId?: string;
  taskId?: string;
  createdAt: string;
}

// ── Finance ──
export type ExpenseCategory = 'food' | 'travel' | 'shopping' | 'education' | 'bills' | 'entertainment' | 'health' | 'other';

export interface Expense {
  id: string;
  userId: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  description: string;
  notes?: string;
}

export interface Income {
  id: string;
  userId: string;
  amount: number;
  source: string;
  date: string;
  category: string;
  notes?: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  progress: number;
  createdAt: string;
}

// ── Learning ──
export interface LearningSubject {
  id: string;
  userId: string;
  name: string;
  icon: string;
  color: string;
  progress: number;
  totalTopics: number;
  completedTopics: number;
  totalTimeMinutes: number;
}

export interface LearningTopic {
  id: string;
  subjectId: string;
  name: string;
  status: 'not_started' | 'in_progress' | 'completed';
  difficulty: 'easy' | 'medium' | 'hard';
  timeSpentMinutes: number;
  notes?: string;
}

// ── Projects ──
export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  priority: Priority;
  deadline?: string;
  progress: number;
  createdAt: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  status: 'pending' | 'completed';
  orderIndex: number;
  completedAt?: string;
}

// ── Progress ──
export interface ProgressScore {
  category: string;
  score: number;
  change: number;
  icon: string;
  color: string;
}

// ── Reviews ──
export interface DailyReview {
  id: string;
  userId: string;
  date: string;
  completedTasks: number;
  totalTasks: number;
  completedHabits: number;
  totalHabits: number;
  score: number;
  aiSummary: string;
  whatWentWell: string[];
  whatWentWrong: string[];
  suggestions: string[];
}

export interface WeeklyReview {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd: string;
  overallScore: number;
  categoryScores: ProgressScore[];
  biggestAchievement: string;
  biggestProblem: string;
  nextWeekPriorities: string[];
}

// ── Notifications ──
export type NotificationType = 'task_reminder' | 'habit_reminder' | 'goal_deadline' | 'savings_alert' | 'daily_review' | 'weekly_review' | 'ai_recommendation' | 'missed_task';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  scheduledAt: string;
  sentAt?: string;
  readAt?: string;
  status: 'pending' | 'sent' | 'read';
}

// ── AI ──
export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  actions?: AiAction[];
}

export interface AiAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary';
  action: string;
}

// ── Memory ──
export type MemoryType = 'preference' | 'fact' | 'goal' | 'decision' | 'experience' | 'routine' | 'lesson' | 'note';

export interface Memory {
  id: string;
  userId: string;
  text: string;
  memoryType: MemoryType;
  importance: number;
  createdAt: string;
  updatedAt: string;
}
