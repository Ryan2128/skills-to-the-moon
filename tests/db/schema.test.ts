import { describe, expect, it } from "vitest";

import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";

describe("database schema", () => {
	it("creates all required tables", () => {
		const db = createDatabase(":memory:");
		runMigrations(db);

		const tables = db
			.prepare("select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name")
			.all()
			.map((row) => (row as { name: string }).name);

		expect(tables).toEqual(["feedback_events", "merge_requests", "purge_audit_logs", "skill_invocations"]);
	});

	it("enforces merge request status values", () => {
		const db = createDatabase(":memory:");
		runMigrations(db);

		expect(() => {
			db.prepare(
				"insert into merge_requests (mr_url, title, head_commit_hash, iteration_type, feedback_id_start, feedback_id_end, status, opened_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
			).run(
				"https://example.com/mr/1",
				"[skills-feedback][minor][feedback:1-2] 2026-06-11 updates",
				"abc123",
				"minor",
				1,
				2,
				"waiting",
				"2026-06-11T00:00:00.000Z"
			);
		}).toThrow();
	});

	it("enforces feedback event confidence and review flag ranges", () => {
		const db = createDatabase(":memory:");
		runMigrations(db);

		const insertFeedback = db.prepare(
			"insert into feedback_events (skill_name, working_directory, tech_stack_json, ai_output, user_correction_input, classification_confidence, needs_batch_review, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
		);

		expect(() => {
			insertFeedback.run(
				"test-skill",
				"/repo",
				JSON.stringify(["typescript"]),
				"ai output",
				"user correction",
				1.1,
				0,
				"2026-06-11T00:00:00.000Z"
			);
		}).toThrow();

		expect(() => {
			insertFeedback.run(
				"test-skill",
				"/repo",
				JSON.stringify(["typescript"]),
				"ai output",
				"user correction",
				0.5,
				2,
				"2026-06-11T00:00:00.000Z"
			);
		}).toThrow();
	});

	it("enforces feedback id range order on merge requests", () => {
		const db = createDatabase(":memory:");
		runMigrations(db);

		expect(() => {
			db.prepare(
				"insert into merge_requests (mr_url, title, head_commit_hash, iteration_type, feedback_id_start, feedback_id_end, status, opened_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
			).run(
				"https://example.com/mr/2",
				"[skills-feedback][minor][feedback:2-1] 2026-06-11 updates",
				"abc123",
				"minor",
				2,
				1,
				"open",
				"2026-06-11T00:00:00.000Z"
			);
		}).toThrow();
	});
});
