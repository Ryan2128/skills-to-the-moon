import Fastify from "fastify";

import type { Db } from "./db/connection.js";
import { toCsv } from "./domain/csv.js";
import { parseMergeRequestTitle } from "./domain/mr-title.js";
import {
	createFeedbackEvent,
	createSkillInvocation,
	getLatestMergeRequest,
	getMergeRequestById,
	listFeedbackByDateRange,
	purgeFeedbackForMergeRequest,
	updateMergeRequestStatus,
	upsertMergeRequest
} from "./domain/repositories.js";
import {
	feedbackInputSchema,
	mergeRequestInputSchema,
	mergeRequestStatusInputSchema,
	skillInvocationInputSchema
} from "./domain/schemas.js";

type BuildAppOptions = {
	db: Db;
};

const feedbackCsvHeaders: Array<
	| "id"
	| "skill_name"
	| "working_directory"
	| "tech_stack"
	| "ai_output"
	| "user_correction_input"
	| "classification_confidence"
	| "needs_batch_review"
	| "created_at"
> = [
	"id",
	"skill_name",
	"working_directory",
	"tech_stack",
	"ai_output",
	"user_correction_input",
	"classification_confidence",
	"needs_batch_review",
	"created_at"
];

type RouteParamsWithId = {
	id: string;
};

type FeedbackCsvQuery = {
	from?: string;
	to?: string;
};

function parsePositiveIntegerId(rawId: string): number | null {
	const id = Number(rawId);

	return Number.isInteger(id) && id > 0 ? id : null;
}

export function buildApp(options: BuildAppOptions) {
	const app = Fastify({ logger: false });

	app.post("/api/skill-invocations", async (request, reply) => {
		const parsed = skillInvocationInputSchema.safeParse(request.body);

		if (!parsed.success) {
			return reply.code(400).send({
				error: "Invalid skill invocation payload",
				details: parsed.error.flatten()
			});
		}

		const id = createSkillInvocation(options.db, parsed.data);

		return reply.code(201).send({ id });
	});

	app.post("/api/feedback", async (request, reply) => {
		const parsed = feedbackInputSchema.safeParse(request.body);

		if (!parsed.success) {
			return reply.code(400).send({
				error: "Invalid feedback payload",
				details: parsed.error.flatten()
			});
		}

		const id = createFeedbackEvent(options.db, parsed.data);

		return reply.code(201).send({ id });
	});

	app.get("/api/feedback.csv", async (request, reply) => {
		const query = request.query as FeedbackCsvQuery;

		if (!query.from || !query.to) {
			return reply.code(400).send({ error: "from and to query parameters are required" });
		}

		const rows = listFeedbackByDateRange(options.db, query.from, query.to).map((row) => ({
			id: row.id,
			skill_name: row.skill_name,
			working_directory: row.working_directory,
			tech_stack: row.tech_stack.join(";"),
			ai_output: row.ai_output,
			user_correction_input: row.user_correction_input,
			classification_confidence: row.classification_confidence,
			needs_batch_review: row.needs_batch_review,
			created_at: row.created_at
		}));

		const csv = toCsv(feedbackCsvHeaders, rows);

		return reply.type("text/csv; charset=utf-8").send(csv);
	});

	app.get("/api/latest-merge-request", async (_request, reply) => {
		const latest = getLatestMergeRequest(options.db);

		if (!latest) {
			return reply.code(404).send({ error: "No merge request recorded" });
		}

		return reply.send(latest);
	});

	app.post("/api/merge-requests", async (request, reply) => {
		const parsed = mergeRequestInputSchema.safeParse(request.body);

		if (!parsed.success) {
			return reply.code(400).send({
				error: "Invalid merge request payload",
				details: parsed.error.flatten()
			});
		}

		let parsedTitle;

		try {
			parsedTitle = parseMergeRequestTitle(parsed.data.title);
		} catch (error) {
			return reply.code(400).send({
				error: error instanceof Error ? error.message : "Invalid merge request title"
			});
		}

		if (
			parsedTitle.iteration_type !== parsed.data.iteration_type ||
			parsedTitle.feedback_id_start !== parsed.data.feedback_id_start ||
			parsedTitle.feedback_id_end !== parsed.data.feedback_id_end
		) {
			return reply.code(400).send({
				error: "Merge request title feedback range does not match payload"
			});
		}

		const id = upsertMergeRequest(options.db, parsed.data);

		return reply.code(201).send({ id });
	});

	app.patch("/api/merge-requests/:id/status", async (request, reply) => {
		const params = request.params as RouteParamsWithId;
		const id = parsePositiveIntegerId(params.id);

		if (!id) {
			return reply.code(400).send({ error: "Invalid merge request id" });
		}

		const parsed = mergeRequestStatusInputSchema.safeParse(request.body);

		if (!parsed.success) {
			return reply.code(400).send({
				error: "Invalid merge request status payload",
				details: parsed.error.flatten()
			});
		}

		updateMergeRequestStatus(options.db, id, parsed.data);

		return reply.send({ id });
	});

	app.post("/api/admin/merge-requests/:id/purge", async (request, reply) => {
		const params = request.params as RouteParamsWithId;
		const id = parsePositiveIntegerId(params.id);

		if (!id) {
			return reply.code(400).send({ error: "Invalid merge request id" });
		}

		const mergeRequest = getMergeRequestById(options.db, id);

		if (!mergeRequest) {
			return reply.code(404).send({ error: "Merge request not found" });
		}

		try {
			const deletedCount = purgeFeedbackForMergeRequest(options.db, mergeRequest, new Date().toISOString());

			return reply.send({ deleted_count: deletedCount });
		} catch (error) {
			return reply.code(409).send({
				error: error instanceof Error ? error.message : "Purge failed"
			});
		}
	});

	return app;
}
