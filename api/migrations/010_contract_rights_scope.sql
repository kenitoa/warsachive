CREATE TABLE contract_details (contract_id TEXT PRIMARY KEY REFERENCES contracts(id), required_rights_ids TEXT NOT NULL, required_permissions TEXT NOT NULL, territory TEXT NOT NULL);
