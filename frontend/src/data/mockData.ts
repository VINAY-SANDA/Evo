/**
 * DEPRECATED: Mock data has been completely removed.
 * EVO now queries live PostgreSQL (Supabase) via the backend API.
 * All state is live, persistent, and synchronized in real-time.
 */

export const mockUser = null;
export const mockGoals = [];
export const mockMilestones = [];
export const mockTasks = [];
export const mockHabits = [];
export const mockReminders = [];
export const mockExpenses = [];
export const mockIncome = [];
export const mockSavingsGoals = [];
export const mockLearningSubjects = [];
export const mockLearningTopics = [];
export const mockProjects = [];
export const mockProjectMilestones = [];
export const mockProgressScores = [];
export const mockDailyReview = null;
export const mockWeeklyReview = null;
export const mockNotifications = [];
export const mockAiMessages = [];
export const mockMemories = [];

export function getTodayTasks() { return []; }
export function getOverallScore() { return 0; }
export function getMonthlyExpenses() { return 0; }
export function getMonthlyIncome() { return 0; }
