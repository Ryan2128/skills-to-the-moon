import { describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app.js";
import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";

function testApp(options: { adminToken?: string } = {}) {
	const db = createDatabase(":memory:");
	runMigrations(db);

	return buildApp({ db, adminToken: options.adminToken });
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

	it("rejects merged merge requests without merged_at", async () => {
		const app = testApp();

		const response = await app.inject({
			method: "POST",
			url: "/api/merge-requests",
			payload: {
				mr_url: "https://example.com/mr/1",
				title: "[skills-feedback][major][feedback:1-2] 2026-06-11 skill review",
				head_commit_hash: "abc123",
				iteration_type: "major",
				feedback_id_start: 1,
				feedback_id_end: 2,
				status: "merged",
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
		const app = testApp({ adminToken: "secret" });
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

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/merge-requests/1/purge?admin_token=secret"
		});

		expect(response.statusCode).toBe(409);
	});

	it("requires an admin token before purging feedback", async () => {
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
				status: "merged",
				opened_at: "2026-06-11T00:10:00.000Z",
				merged_at: "2026-06-11T00:20:00.000Z"
			}
		});

		const response = await app.inject({ method: "POST", url: "/api/admin/merge-requests/1/purge" });

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({ error: "Admin token is not configured" });
	});

	it("rejects an invalid admin token before purging feedback", async () => {
		const app = testApp({ adminToken: "secret" });
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
				status: "merged",
				opened_at: "2026-06-11T00:10:00.000Z",
				merged_at: "2026-06-11T00:20:00.000Z"
			}
		});

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/merge-requests/1/purge?admin_token=wrong"
		});

		expect(response.statusCode).toBe(403);
		expect(response.json()).toEqual({ error: "Invalid admin token" });
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

	it("rejects merged status updates without merged_at", async () => {
		const app = testApp();

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

		const response = await app.inject({
			method: "PATCH",
			url: "/api/merge-requests/1/status",
			payload: {
				status: "merged"
			}
		});

		expect(response.statusCode).toBe(400);
	});

	it("does not purge feedback for a merged minor merge request", async () => {
		const app = testApp({ adminToken: "secret" });
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
				status: "merged",
				opened_at: "2026-06-11T00:10:00.000Z",
				merged_at: "2026-06-11T00:20:00.000Z"
			}
		});

		const response = await app.inject({
			method: "POST",
			url: "/api/admin/merge-requests/1/purge?admin_token=secret"
		});

		expect(response.statusCode).toBe(409);
		expect(response.json()).toEqual({ error: "Only major merge requests can purge feedback" });
	});

	it("updates merge request status and purges merged feedback", async () => {
		const app = testApp({ adminToken: "secret" });
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

		const purgeResponse = await app.inject({
			method: "POST",
			url: "/api/admin/merge-requests/1/purge",
			headers: {
				"content-type": "application/x-www-form-urlencoded"
			},
			payload: "admin_token=secret"
		});

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
