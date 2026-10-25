import { query } from '../db/connection.js';

/** Apply additive feature migrations so existing hosted databases need no manual reset. */
export async function ensureFeatureTables(): Promise<void> {
  await query(`
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_frequency VARCHAR(16);
    ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_series_id UUID;
    ALTER TABLE habits ADD COLUMN IF NOT EXISTS schedule_days INT[];
    CREATE UNIQUE INDEX IF NOT EXISTS tasks_recurrence_series_date_uq
      ON tasks (recurrence_series_id, due_date) WHERE recurrence_series_id IS NOT NULL;

    CREATE TABLE IF NOT EXISTS goal_check_ins (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      value NUMERIC NOT NULL,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE learning_topics ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE learning_topics ADD COLUMN IF NOT EXISTS resource_url TEXT;
    ALTER TABLE learning_topics ADD COLUMN IF NOT EXISTS next_review_date DATE;

    CREATE TABLE IF NOT EXISTS finance_budgets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category VARCHAR(64) NOT NULL,
      month DATE NOT NULL,
      limit_amount NUMERIC(12, 2) NOT NULL CHECK (limit_amount > 0),
      alert_percent INT NOT NULL DEFAULT 80 CHECK (alert_percent BETWEEN 1 AND 100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, category, month)
    );

    CREATE TABLE IF NOT EXISTS savings_contributions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      savings_goal_id UUID NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS learning_study_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject_id UUID NOT NULL REFERENCES learning_subjects(id) ON DELETE CASCADE,
      topic_id UUID REFERENCES learning_topics(id) ON DELETE SET NULL,
      duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
      note TEXT,
      studied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
