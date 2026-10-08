CREATE TABLE publication_evidence (record_id TEXT NOT NULL, content_hash TEXT NOT NULL, reviewer_id TEXT NOT NULL REFERENCES users(id), approved_at TEXT NOT NULL, revision INTEGER NOT NULL, PRIMARY KEY(record_id,content_hash));
CREATE TABLE publication_withheld (record_id TEXT PRIMARY KEY, withheld_at TEXT NOT NULL, reviewer_id TEXT NOT NULL REFERENCES users(id));
CREATE TABLE draft_private_notes (draft_id TEXT PRIMARY KEY REFERENCES drafts(id), note TEXT NOT NULL, updated_at TEXT NOT NULL);
