CREATE TABLE download_files (token TEXT PRIMARY KEY, filename TEXT NOT NULL, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX download_files_expiry ON download_files(expires_at);
