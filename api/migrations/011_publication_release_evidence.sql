-- Preserve every legacy stage and closure. A later release may publish the same
-- approved revision and channel bytes under a different commit SHA.
CREATE TABLE publication_release_stages (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  content_hash TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('build','deploy','feed')),
  commit_sha TEXT NOT NULL,
  artifact_hash TEXT NOT NULL,
  url TEXT,
  observed_at TEXT NOT NULL,
  evidence_source TEXT NOT NULL,
  UNIQUE(record_id,revision,stage,commit_sha,artifact_hash)
);
CREATE VIEW publication_stage_evidence AS
  SELECT * FROM publication_stages
  UNION ALL
  SELECT * FROM publication_release_stages;
CREATE TABLE correction_release_closures (
  correction_id TEXT PRIMARY KEY REFERENCES corrections(id),
  revision INTEGER NOT NULL,
  publication_id TEXT NOT NULL REFERENCES publication_release_stages(id),
  evidence TEXT NOT NULL,
  closed_by TEXT NOT NULL REFERENCES users(id),
  closed_at TEXT NOT NULL
);
CREATE VIEW correction_closure_evidence AS
  SELECT * FROM correction_closures
  UNION ALL
  SELECT * FROM correction_release_closures;
