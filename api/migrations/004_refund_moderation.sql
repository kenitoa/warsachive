CREATE TABLE refund_notes (request_id TEXT PRIMARY KEY REFERENCES refund_requests(id), reason TEXT NOT NULL, moderation_note TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL);
