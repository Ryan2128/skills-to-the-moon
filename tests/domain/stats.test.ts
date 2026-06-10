import { describe, expect, it } from "vitest";

import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";
import { createFeedbackEvent, createSkillInvocation } from "../../src/server/domain/repositories.js";
import { getSkillStats, getTotals } from "../../src/server/domain/stats.js";

describe("skill stats", () => {
	it("returns total invocation and correction counts", () => {
		const db = createDatabase(":memory:");
		runMigrations(db);

		createSkillInvocation(db, {
			skill_name: "superpowers:brainstorming",
			working_directory: "/repo/project",
			tech_stack: ["typescript"],
			started_at: "2026-06-11T00:00:00.000Z",
			status: "success"
		});
		createFeedbackEvent(db, {
			skill_name: "superpowers:brainstorming",
			working_directory: "/repo/project",
			tech_stack: ["typescript"],
			ai_output: "wrong",
			user_correction_input: "不对",
			classification_confidence: 0.9,
			needs_batch_review: false,
			created_at: "2026-06-11T00:01:00.000Z"
		});

		expect(getTotals(db)).toEqual({
			invocation_count: 1,
			correction_count: 1
		});
	});

	it("aggregates invocations, corrections, and correction rate by skill", () => {
		const db = createDatabase(":memory:");
		runMigrations(db);

		for (const status of ["success", "failed", "unknown"] as const) {
			createSkillInvocation(db, {
				skill_name: "superpowers:brainstorming",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				started_at: "2026-06-11T00:00:00.000Z",
				status
			});
		}
		createSkillInvocation(db, {
			skill_name: "superpowers:test-driven-development",
			working_directory: "/repo/project",
			tech_stack: ["typescript"],
			started_at: "2026-06-11T00:03:00.000Z",
			status: "success"
		});

		for (const skillName of [
			"superpowers:brainstorming",
			"superpowers:test-driven-development",
			"superpowers:test-driven-development",
			"superpowers:verification-before-completion"
		]) {
			createFeedbackEvent(db, {
				skill_name: skillName,
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				ai_output: "wrong",
				user_correction_input: "不对",
				classification_confidence: 0.9,
				needs_batch_review: false,
				created_at: "2026-06-11T00:04:00.000Z"
			});
		}

		const stats = getSkillStats(db);

		expect(stats).toHaveLength(3);
		expect(stats[0]).toMatchObject({
			skill_name: "superpowers:brainstorming",
			invocation_count: 3,
			correction_count: 1
		});
		expect(stats[0]?.correction_rate).toBeCloseTo(1 / 3);
		expect(stats[1]).toEqual({
			skill_name: "superpowers:test-driven-development",
			invocation_count: 1,
			correction_count: 2,
			correction_rate: 2
		});
		expect(stats[2]).toEqual({
			skill_name: "superpowers:verification-before-completion",
			invocation_count: 0,
			correction_count: 1,
			correction_rate: 0
		});
	});
});
