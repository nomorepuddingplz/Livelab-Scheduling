-- Scheduling overlaps are allowed and surfaced as live alerts.
DROP TRIGGER IF EXISTS event_room_insert;
--> statement-breakpoint
DROP TRIGGER IF EXISTS event_room_update;
--> statement-breakpoint
DROP TRIGGER IF EXISTS assignment_overlap;
