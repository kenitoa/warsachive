CREATE TABLE attachments (id TEXT PRIMARY KEY, record_id TEXT NOT NULL, source_id TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id), content_type TEXT NOT NULL, extension TEXT NOT NULL, size INTEGER NOT NULL, sha256 TEXT NOT NULL, filename TEXT NOT NULL UNIQUE, rights TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX attachment_record ON attachments(record_id);
