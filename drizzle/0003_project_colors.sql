UPDATE projects SET color = 'auto:' || (SELECT COUNT(*) - 1 FROM projects AS p WHERE p.created_at < projects.created_at OR (p.created_at = projects.created_at AND p.id <= projects.id));
