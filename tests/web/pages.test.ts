import { describe, expect, it } from "vitest";

import { buildApp } from "../../src/server/app.js";
import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";
import {
	createFeedbackEvent,
	createSkillInvocation,
	upsertMergeRequest
} from "../../src/server/domain/repositories.js";

function testContext() {
	const db = createDatabase(":memory:");
	runMigrations(db);

	return {
		db,
		app: buildApp({ db })
	};
}

describe("web pages", () => {
	it("renders the skill monitoring dashboard with totals and skill table", async () => {
		const { app, db } = testContext();

		for (const skill_name of [
			"superpowers:brainstorming",
			"superpowers:brainstorming",
			"superpowers:test-driven-development",
			'custom<script>"skill'
		]) {
			createSkillInvocation(db, {
				skill_name,
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				started_at: "2026-06-11T00:00:00.000Z",
				status: "success"
			});
		}
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

		const response = await app.inject({ method: "GET", url: "/" });

		expect(response.statusCode).toBe(200);
		expect(response.headers["content-type"]).toContain("text/html");
		expect(response.body).toContain("Skill 调用监控");
		expect(response.body).toContain("总调用");
		expect(response.body).toContain("纠错反馈数");
		expect(response.body).toContain("superpowers:brainstorming");
		expect(response.body).toContain("50.0%");
		expect(response.body).toContain("superpowers:test-driven-development");
		expect(response.body).toContain("0.0%");
		expect(response.body).toContain("custom&lt;script&gt;&quot;skill");
		expect(response.body).not.toContain('custom<script>"skill');
	});

	it("renders the admin page empty state", async () => {
		const { app } = testContext();

		const response = await app.inject({ method: "GET", url: "/admin" });

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain("系统管理");
		expect(response.body).toContain("合并后清理");
		expect(response.body).toContain("暂无合并请求");
	});

	it("renders latest merge request metadata and purge form", async () => {
		const { app, db } = testContext();

		for (const created_at of [
			"2026-06-11T00:00:00.000Z",
			"2026-06-11T00:01:00.000Z",
			"2026-06-11T00:02:00.000Z"
		]) {
			createFeedbackEvent(db, {
				skill_name: "superpowers:brainstorming",
				working_directory: "/repo/project",
				tech_stack: ["typescript"],
				ai_output: "wrong",
				user_correction_input: "不对",
				classification_confidence: 0.9,
				needs_batch_review: false,
				created_at
			});
		}

		upsertMergeRequest(db, {
			mr_url: "https://example.com/mr/7",
			title: "[skills-feedback][minor][feedback:1-3] 2026-06-11 skill updates",
			head_commit_hash: "abc1234",
			iteration_type: "minor",
			feedback_id_start: 1,
			feedback_id_end: 3,
			status: "merged",
			opened_at: "2026-06-11T00:10:00.000Z",
			merged_at: "2026-06-11T00:20:00.000Z"
		});

		const response = await app.inject({ method: "GET", url: "/admin" });

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain("https://example.com/mr/7");
		expect(response.body).toContain("[skills-feedback][minor][feedback:1-3] 2026-06-11 skill updates");
		expect(response.body).toContain("abc1234");
		expect(response.body).toContain("预计清理记录数");
		expect(response.body).toContain("<dd>3</dd>");
		expect(response.body).toContain('action="/api/admin/merge-requests/1/purge"');
		expect(response.body).toContain("<button type=\"submit\">清理反馈</button>");
	});

	it("disables purge for open merge requests", async () => {
		const { app, db } = testContext();

		upsertMergeRequest(db, {
			mr_url: "https://example.com/mr/8",
			title: "[skills-feedback][minor][feedback:1-3] 2026-06-11 skill updates",
			head_commit_hash: "def5678",
			iteration_type: "minor",
			feedback_id_start: 1,
			feedback_id_end: 3,
			status: "open",
			opened_at: "2026-06-11T00:10:00.000Z"
		});

		const response = await app.inject({ method: "GET", url: "/admin" });

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain("<button type=\"submit\" disabled>清理反馈</button>");
		expect(response.body).toContain("只有合并后的 MR 可以清理反馈。");
	});

	it("disables purge for closed merge requests", async () => {
		const { app, db } = testContext();

		upsertMergeRequest(db, {
			mr_url: "https://example.com/mr/9",
			title: "[skills-feedback][minor][feedback:1-3] 2026-06-11 skill updates",
			head_commit_hash: "fed9876",
			iteration_type: "minor",
			feedback_id_start: 1,
			feedback_id_end: 3,
			status: "closed",
			opened_at: "2026-06-11T00:10:00.000Z"
		});

		const response = await app.inject({ method: "GET", url: "/admin" });

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain("<button type=\"submit\" disabled>清理反馈</button>");
		expect(response.body).toContain("已关闭的 MR 不能清理反馈。");
	});

	it("disables purge for already purged merge requests", async () => {
		const { app, db } = testContext();

		const mergeRequestId = upsertMergeRequest(db, {
			mr_url: "https://example.com/mr/10",
			title: "[skills-feedback][major][feedback:1-3] 2026-06-11 skill review",
			head_commit_hash: "123abcd",
			iteration_type: "major",
			feedback_id_start: 1,
			feedback_id_end: 3,
			status: "merged",
			opened_at: "2026-06-11T00:10:00.000Z",
			merged_at: "2026-06-11T00:20:00.000Z"
		});
		db.prepare("update merge_requests set purged_at = ? where id = ?").run(
			"2026-06-11T00:30:00.000Z",
			mergeRequestId
		);

		const response = await app.inject({ method: "GET", url: "/admin" });

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain("<button type=\"submit\" disabled>清理反馈</button>");
		expect(response.body).toContain("已在 2026-06-11T00:30:00.000Z 清理");
	});

	it("renders unsafe merge request URLs as text instead of links", async () => {
		const { app, db } = testContext();

		upsertMergeRequest(db, {
			mr_url: "javascript:alert(1)",
			title: "[skills-feedback][minor][feedback:1-3] 2026-06-11 skill updates",
			head_commit_hash: "badcafe",
			iteration_type: "minor",
			feedback_id_start: 1,
			feedback_id_end: 3,
			status: "open",
			opened_at: "2026-06-11T00:10:00.000Z"
		});

		const response = await app.inject({ method: "GET", url: "/admin" });

		expect(response.statusCode).toBe(200);
		expect(response.body).toContain("javascript:alert(1)");
		expect(response.body).not.toContain('href="javascript:alert(1)"');
	});
});
