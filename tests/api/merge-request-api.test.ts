import { describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app.js";
import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";

function testApp() {
	const db = createDatabase(":memory:");
	runMigrations(db);

	return buildApp({ db });
}

async function seedFeedback(app: ReturnType<typeof buildApp>) {
	for (const created_at of ["2026-06-11T00:00:00.000Z", "2026-06-11T00:01:00.000Z"]) {
		await app.inject({
			method: "POST",
			url: "/api/feedback",
			payload: {
				skill_name: "superpowers:brainstorming",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				ai_output: "wrong",
				user_correction_input: "不对",
				classification_confidence: 0.9,
				needs_batch_review: false,
				created_at
			}
		});
	}
}

describe("merge request API", () => {
	it("returns 404 when no merge request has been recorded", async () => {
		const app = testApp();

		const response = await app.inject({ method: "GET", url: "/api/latest-merge-request" });

		expect(response.statusCode).toBe(404);
	});

	it("records and returns latest merge request", async () => {
		const app = testApp();

		const createResponse = await app.inject({
			method: "POST",
			url: "/api/merge-requests",
			payload: {
				mr_url: "https://example.com/mr/1",
				title: "[skills-feedback][minor][feedback:1-2] 2026-06-11 skill updates",
				head_commit_hash: "abc123",
				iteration_type: "minor",
				feedback_id_start: 1,
				feedback_id_end: 2,
				status: "open",
				opened_at: "2026-06-11T00:10:00.000Z"
			}
		});

		expect(createResponse.statusCode).toBe(201);
		expect(createResponse.json()).toEqual({ id: 1 });

		const latestResponse = await app.inject({ method: "GET", url: "/api/latest-merge-request" });

		expect(latestResponse.statusCode).toBe(200);
		expect(latestResponse.json()).toMatchObject({
			id: 1,
			mr_url: "https://example.com/mr/1",
			head_commit_hash: "abc123",
			feedback_id_start: 1,
			feedback_id_end: 2,
			status: "open"
		});
	});

	it("rejects merge request titles without feedback range", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/merge-requests",
			payload: {
				mr_url: "https://example.com/mr/1",
				title: "plain title",
				head_commit_hash: "abc123",
				iteration_type: "minor",
				feedback_id_start: 1,
				feedback_id_end: 2,
				status: "open",
				opened_at: "2026-06-11T00:10:00.000Z"
			}
		});

		expect(response.statusCode).toBe(400);
	});

	it("rejects merge request URLs with unsafe protocols", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/merge-requests",
			payload: {
				mr_url: "javascript:alert(1)",
				title: "[skills-feedback][minor][feedback:1-2] 2026-06-11 skill updates",
				head_commit_hash: "abc123",
				iteration_type: "minor",
				feedback_id_start: 1,
				feedback_id_end: 2,
				status: "open",
				opened_at: "2026-06-11T00:10:00.000Z"
			}
		});

		expect(response.statusCode).toBe(400);
	});

	it("rejects merge request titles that do not match the payload", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/merge-requests",
			payload: {
				mr_url: "https://example.com/mr/1",
				title: "[skills-feedback][major][feedback:1-3] 2026-06-11 skill review",
				head_commit_hash: "abc123",
				iteration_type: "minor",
				feedback_id_start: 1,
				feedback_id_end: 2,
				status: "open",
				opened_at: "2026-06-11T00:10:00.000Z"
			}
		});

		expect(response.statusCode).toBe(400);
	});

	it("does not purge feedback for an open merge request", async () => {
		const app = testApp();
		await seedFeedback(app);

		await app.inject({
			method: "POST",
			url: "/api/merge-requests",
			payload: {
				mr_url: "https://example.com/mr/1",
				title: "[skills-feedback][minor][feedback:1-2] 2026-06-11 skill updates",
				head_commit_hash: "abc123",
				iteration_type: "minor",
				feedback_id_start: 1,
				feedback_id_end: 2,
				status: "open",
				opened_at: "2026-06-11T00:10:00.000Z"
			}
		});

		const response = await app.inject({ method: "POST", url: "/api/admin/merge-requests/1/purge" });

		expect(response.statusCode).toBe(409);
	});

	it("returns 404 when updating a missing merge request status", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "PATCH",
			url: "/api/merge-requests/99/status",
			payload: {
				status: "merged",
				merged_at: "2026-06-11T00:20:00.000Z"
			}
		});

		expect(response.statusCode).toBe(404);
		expect(response.json()).toEqual({ error: "Merge request not found" });
	});

	it("updates merge request status and purges merged feedback", async () => {
		const app = testApp();
		await seedFeedback(app);

		await app.inject({
			method: "POST",
			url: "/api/merge-requests",
			payload: {
				mr_url: "https://example.com/mr/1",
				title: "[skills-feedback][major][feedback:1-2] 2026-06-11 skill review",
				head_commit_hash: "abc123",
				iteration_type: "major",
				feedback_id_start: 1,
				feedback_id_end: 2,
				status: "open",
				opened_at: "2026-06-11T00:10:00.000Z"
			}
		});

		const statusResponse = await app.inject({
			method: "PATCH",
			url: "/api/merge-requests/1/status",
			payload: {
				status: "merged",
				merged_at: "2026-06-11T00:20:00.000Z"
			}
		});

		expect(statusResponse.statusCode).toBe(200);
		expect(statusResponse.json()).toEqual({ id: 1 });

		const purgeResponse = await app.inject({ method: "POST", url: "/api/admin/merge-requests/1/purge" });

		expect(purgeResponse.statusCode).toBe(200);
		expect(purgeResponse.json()).toEqual({ deleted_count: 2 });

		const csvResponse = await app.inject({
			method: "GET",
			url: "/api/feedback.csv?from=2026-06-11T00:00:00.000Z&to=2026-06-11T23:59:59.999Z"
		});

		expect(csvResponse.body).toBe(
			"id,skill_name,working_directory,tech_stack,ai_output,user_correction_input,classification_confidence,needs_batch_review,created_at"
		);
	});
});
