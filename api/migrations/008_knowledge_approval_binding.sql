CREATE TABLE draft_knowledge_checks (draft_id TEXT PRIMARY KEY REFERENCES drafts(id), revision INTEGER NOT NULL, registry_hash TEXT NOT NULL, content_hash TEXT NOT NULL, checked_at TEXT NOT NULL);
