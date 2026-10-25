CREATE INDEX idx_assignments_member_time ON assignments(member_id,start,end);
--> statement-breakpoint
CREATE INDEX idx_assignments_event ON assignments(event_id);
--> statement-breakpoint
CREATE INDEX idx_events_room_time ON events(room_id,room_start,room_end);
--> statement-breakpoint
CREATE INDEX idx_events_time ON events(start,end);
--> statement-breakpoint
CREATE TRIGGER event_room_insert BEFORE INSERT ON events WHEN NEW.cancelled=0 BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM events WHERE cancelled=0 AND room_id=NEW.room_id AND room_start<NEW.room_end AND room_end>NEW.room_start) THEN RAISE(ABORT,'room_conflict') END; END;
--> statement-breakpoint
CREATE TRIGGER event_room_update BEFORE UPDATE ON events WHEN NEW.cancelled=0 BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM events WHERE cancelled=0 AND room_id=NEW.room_id AND id!=NEW.id AND room_start<NEW.room_end AND room_end>NEW.room_start) THEN RAISE(ABORT,'room_conflict') END; END;
--> statement-breakpoint
CREATE TRIGGER event_revision BEFORE UPDATE ON events BEGIN SELECT CASE WHEN NEW.revision!=OLD.revision+1 THEN RAISE(ABORT,'event_changed') END; END;
--> statement-breakpoint
CREATE TRIGGER assignment_overlap BEFORE INSERT ON assignments BEGIN SELECT CASE WHEN EXISTS(SELECT 1 FROM assignments a JOIN events e ON e.id=a.event_id WHERE e.cancelled=0 AND a.member_id=NEW.member_id AND a.event_id!=NEW.event_id AND a.start<NEW.end AND a.end>NEW.start) THEN RAISE(ABORT,'member_conflict') END; END;
