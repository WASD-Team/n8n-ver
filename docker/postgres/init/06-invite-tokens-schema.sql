-- Create invite tokens table for one-time invite links
CREATE TABLE IF NOT EXISTS invite_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS invite_tokens_user_id_idx ON invite_tokens (user_id);
CREATE INDEX IF NOT EXISTS invite_tokens_expires_at_idx ON invite_tokens (expires_at);

-- Clean up expired tokens (optional maintenance)
-- DELETE FROM invite_tokens WHERE expires_at < NOW();
