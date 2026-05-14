CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT
);

INSERT INTO users (name, email)
SELECT 'User ' || i, 'user' || i || '@example.com'
FROM generate_series(1, 100000) AS i;