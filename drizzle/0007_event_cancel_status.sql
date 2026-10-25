ALTER TABLE events ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE events ADD COLUMN cancel_kind TEXT NOT NULL DEFAULT '';
