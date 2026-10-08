CREATE TABLE ai_daily_usage (
  date TEXT PRIMARY KEY,
  reserved_calls INTEGER NOT NULL CHECK (reserved_calls >= 0),
  input_tokens INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens INTEGER NOT NULL CHECK (output_tokens >= 0)
);
