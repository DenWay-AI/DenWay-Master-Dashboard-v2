-- Migration 005: User profiles for role-based access
-- Role is also stored in auth.users.user_metadata for middleware (no DB query on every request)
-- This table stores the rep_id link for rep-role users

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'rep')) DEFAULT 'admin',
  rep_id UUID REFERENCES reps(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_rep_id ON user_profiles(rep_id);

-- HOW TO CREATE USERS:
-- 1. Go to Supabase Dashboard → Authentication → Users → Add User
-- 2. After creating, run this to set their role (example):
--
-- For admin:
--   INSERT INTO user_profiles (id, role) VALUES ('USER_UUID_HERE', 'admin');
--   UPDATE auth.users SET raw_user_meta_data = '{"role":"admin"}' WHERE id = 'USER_UUID_HERE';
--
-- For rep:
--   INSERT INTO user_profiles (id, role, rep_id) VALUES ('USER_UUID_HERE', 'rep', 'REP_UUID_HERE');
--   UPDATE auth.users SET raw_user_meta_data = '{"role":"rep","rep_id":"REP_UUID_HERE"}' WHERE id = 'USER_UUID_HERE';
