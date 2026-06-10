import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

export type Db = Database.Database;

export function createDatabase(filename = "data/skills-feedback.sqlite"): Db {
	if (filename !== ":memory:") {
		mkdirSync(dirname(filename), { recursive: true });
	}

	const db = new Database(filename);
	db.pragma("foreign_keys = ON");

	if (filename !== ":memory:") {
		db.pragma("journal_mode = WAL");
	}

	return db;
}
