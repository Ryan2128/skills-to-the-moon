import { describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app.js";
import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";

function testApp() {
	const db = createDatabase(":memory:");
	runMigrations(db);

	return buildApp({ db });
}

describe("feedback API", () => {
	it("records a skill invocation", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/skill-invocations",
			payload: {
				skill_name: "superpowers:brainstorming",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				started_at: "2026-06-11T00:00:00.000Z",
				finished_at: "2026-06-11T00:01:00.000Z",
				status: "success"
			}
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual({ id: 1 });
	});

	it("rejects feedback-rules skill invocations", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/skill-invocations",
			payload: {
				skill_name: "feedback-rules",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				started_at: "2026-06-11T00:00:00.000Z",
				status: "success"
			}
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: "feedback-rules skill is reserved and must not be reported"
		});
	});

	it("rejects scoped feedback-rules skill invocations", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/skill-invocations",
			payload: {
				skill_name: "feedback-rules-moon",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				started_at: "2026-06-11T00:00:00.000Z",
				status: "success"
			}
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: "feedback-rules skill is reserved and must not be reported"
		});
	});

	it("records correction feedback", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/feedback",
			payload: {
				skill_name: "superpowers:brainstorming",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				ai_output: "错误地把补充当成纠错",
				user_correction_input: "不对，这是补充不是纠错",
				classification_confidence: 0.91,
				needs_batch_review: false,
				created_at: "2026-06-11T00:02:00.000Z"
			}
		});

		expect(response.statusCode).toBe(201);
		expect(response.json()).toEqual({ id: 1 });
	});

	it("rejects feedback-rules correction feedback", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/feedback",
			payload: {
				skill_name: "feedback-rules",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				ai_output: "output",
				user_correction_input: "correction",
				classification_confidence: 0.91,
				needs_batch_review: false,
				created_at: "2026-06-11T00:02:00.000Z"
			}
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: "feedback-rules skill is reserved and must not be reported"
		});
	});

	it("rejects scoped feedback-rules correction feedback", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/feedback",
			payload: {
				skill_name: "feedback-rules-moon",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				ai_output: "output",
				user_correction_input: "correction",
				classification_confidence: 0.91,
				needs_batch_review: false,
				created_at: "2026-06-11T00:02:00.000Z"
			}
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: "feedback-rules skill is reserved and must not be reported"
		});
	});

	it("rejects invalid feedback confidence", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/feedback",
			payload: {
				skill_name: "superpowers:brainstorming",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				ai_output: "output",
				user_correction_input: "correction",
				classification_confidence: 1.5,
				needs_batch_review: false,
				created_at: "2026-06-11T00:02:00.000Z"
			}
		});

		expect(response.statusCode).toBe(400);
	});

	it("exports feedback as CSV for a date range", async () => {
		const app = testApp();

		await app.inject({
			method: "POST",
			url: "/api/feedback",
			payload: {
				skill_name: "superpowers:brainstorming",
				working_directory: "/repo/project",
				tech_stack: ["typescript", "fastify"],
				ai_output: "output with, comma",
				user_correction_input: "不对",
				classification_confidence: 0.88,
				needs_batch_review: false,
				created_at: "2026-06-11T00:02:00.000Z"
			}
		});

		const response = await app.inject({
			method: "GET",
			url: "/api/feedback.csv?from=2026-06-11T00:00:00.000Z&to=2026-06-11T23:59:59.999Z"
		});

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toContain("text/csv");
		expect(response.body).toContain(
			"id,skill_name,working_directory,tech_stack,ai_output,user_correction_input,classification_confidence,needs_batch_review,created_at"
		);
		expect(response.body).toContain("typescript;fastify");
		expect(response.body).toContain('"output with, comma"');
	});

	it("exports feedback for a date-only CSV range", async () => {
		const app = testApp();

		await app.inject({
			method: "POST",
			url: "/api/feedback",
			payload: {
				skill_name: "superpowers:brainstorming",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				ai_output: "same day output",
				user_correction_input: "不对",
				classification_confidence: 0.88,
				needs_batch_review: false,
				created_at: "2026-06-11T18:02:00.000Z"
			}
		});

		const response = await app.inject({
			method: "GET",
			url: "/api/feedback.csv?from=2026-06-11&to=2026-06-11"
		});

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain("same day output");
	});

	it("requires a CSV date range", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "GET",
			url: "/api/feedback.csv?from=2026-06-11T00:00:00.000Z"
		});

		expect(response.statusCode).toBe(400);
	});
});
