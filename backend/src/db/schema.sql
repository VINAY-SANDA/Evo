-- EVO Personal AI Operating System Database Schema
-- Compatible with PostgreSQL 15+ and pgvector

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ── Users ──
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    timezone VARCHAR(64) DEFAULT 'Asia/Kolkata',
    ai_tone VARCHAR(32) DEFAULT 'rigorous',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Goals ──
CREATE TABLE IF NOT EXISTS goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL, -- career, education, finance, health, business, personal
    target_value NUMERIC NOT NULL,
    current_value NUMERIC NOT NULL DEFAULT 0,
    unit VARCHAR(32) NOT NULL,
    deadline DATE NOT NULL,
    priority VARCHAR(16) NOT NULL DEFAULT 'medium', -- high, medium, low
    status VARCHAR(16) NOT NULL DEFAULT 'active', -- active, paused, completed
    progress NUMERIC GENERATED ALWAYS AS (
        CASE WHEN target_value > 0 THEN LEAST(100, ROUND((current_value / target_value) * 100)) ELSE 0 END
    ) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Goal Milestones ──
CREATE TABLE IF NOT EXISTS goal_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    order_index INT NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'pending', -- pending, in_progress, completed
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Projects ──
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    priority VARCHAR(16) NOT NULL DEFAULT 'medium',
    deadline DATE,
    progress INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Project Milestones ──
CREATE TABLE IF NOT EXISTS project_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    order_index INT NOT NULL DEFAULT 1,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    completed_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Tasks ──
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE NOT NULL,
    due_time TIME,
    priority VARCHAR(16) NOT NULL DEFAULT 'medium',
    status VARCHAR(16) NOT NULL DEFAULT 'todo', -- todo, in_progress, completed, deferred
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'General',
    estimated_minutes INT DEFAULT 30,
    is_recurring BOOLEAN DEFAULT FALSE,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Habits ──
CREATE TABLE IF NOT EXISTS habits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(32) DEFAULT '🔥',
    color VARCHAR(32) DEFAULT '#6C5CE7',
    frequency VARCHAR(16) NOT NULL DEFAULT 'daily',
    target INT NOT NULL DEFAULT 1,
    unit VARCHAR(32) NOT NULL DEFAULT 'times',
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Habit Daily Logs ──
CREATE TABLE IF NOT EXISTS habit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    habit_id UUID NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    value INT NOT NULL DEFAULT 1,
    completed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (habit_id, log_date)
);

-- ── Reminders ──
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(16) NOT NULL DEFAULT 'daily', -- daily, weekly, custom
    time TIME NOT NULL,
    days_of_week INT[], -- 0: Sunday, 1: Monday, etc.
    active BOOLEAN NOT NULL DEFAULT TRUE,
    goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Expenses ──
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    category VARCHAR(64) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Income ──
CREATE TABLE IF NOT EXISTS incomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL,
    source VARCHAR(255) NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    category VARCHAR(64) NOT NULL DEFAULT 'General',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Savings Goals ──
CREATE TABLE IF NOT EXISTS savings_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    target_amount NUMERIC(12, 2) NOT NULL,
    current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    deadline DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Learning Tracks ──
CREATE TABLE IF NOT EXISTS learning_subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    icon VARCHAR(32) DEFAULT '📖',
    color VARCHAR(32) DEFAULT '#00D2FF',
    progress INT NOT NULL DEFAULT 0,
    total_topics INT NOT NULL DEFAULT 0,
    completed_topics INT NOT NULL DEFAULT 0,
    total_time_minutes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learning_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID NOT NULL REFERENCES learning_subjects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'not_started',
    difficulty VARCHAR(16) NOT NULL DEFAULT 'medium',
    time_spent_minutes INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Reviews & Retrospectives ──
CREATE TABLE IF NOT EXISTS daily_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    completed_tasks INT NOT NULL DEFAULT 0,
    total_tasks INT NOT NULL DEFAULT 0,
    completed_habits INT NOT NULL DEFAULT 0,
    total_habits INT NOT NULL DEFAULT 0,
    score INT NOT NULL DEFAULT 0,
    ai_summary TEXT,
    what_went_well JSONB DEFAULT '[]'::jsonb,
    what_went_wrong JSONB DEFAULT '[]'::jsonb,
    suggestions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, date)
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    overall_score INT NOT NULL DEFAULT 0,
    category_scores JSONB DEFAULT '[]'::jsonb,
    biggest_achievement TEXT,
    biggest_problem TEXT,
    next_week_priorities JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── Notifications ──
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ── AI Long-Term Memory (with pgvector embedding) ──
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    memory_type VARCHAR(32) NOT NULL DEFAULT 'preference', -- preference, decision, fact, lesson
    importance INT NOT NULL DEFAULT 5, -- 1 to 10
    embedding vector(1536), -- OpenAI / standard 1536-dim vector for semantic search
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Cosine distance vector index for lightning-fast memory retrieval
CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Helper function: Semantic memory retrieval
CREATE OR REPLACE FUNCTION match_memories(
    query_embedding vector(1536),
    match_threshold float,
    match_count int,
    p_user_id uuid
)
RETURNS TABLE (
    id uuid,
    text text,
    memory_type varchar,
    importance int,
    similarity float
)
LANGUAGE sql STABLE
AS $$
    SELECT
        m.id,
        m.text,
        m.memory_type,
        m.importance,
        1 - (m.embedding <=> query_embedding) AS similarity
    FROM memories m
    WHERE m.user_id = p_user_id
      AND 1 - (m.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
$$;
