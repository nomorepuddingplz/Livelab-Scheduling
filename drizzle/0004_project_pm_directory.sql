INSERT OR IGNORE INTO pms (id,name,email,archived) SELECT lower(hex(randomblob(16))),pm,'',0 FROM projects WHERE pm != '' GROUP BY pm;
