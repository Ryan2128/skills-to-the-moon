import type { Db } from "../db/connection.js";
import type {
	FeedbackInput,
	MergeRequestInput,
	MergeRequestStatusInput,
	SkillInvocationInput
} from "./schemas.js";

export type SkillInvocationRow = {
	id: number;
	skill_name: string;
	working_directory: string;
	tech_stack: string[];
	started_at: string;
	finished_at: string | null;
	status: "success" | "failed" | "unknown";
};

export type FeedbackRow = {
	id: number;
	skill_name: string;
	working_directory: string;
	tech_stack: string[];
	ai_output: string;
	user_correction_input: string;
	classification_confidence: number;
	needs_batch_review: boolean;
	created_at: string;
};

export type MergeRequestRow = {
	id: number;
	mr_url: string;
	title: string;
	head_commit_hash: string;
	iteration_type: "minor" | "major";
	feedback_id_start: number;
	feedback_id_end: number;
	status: "open" | "merged" | "closed";
	opened_at: string;
	merged_at: string | null;
	purged_at: string | null;
};

type FeedbackDbRow = Omit<FeedbackRow, "tech_stack" | "needs_batch_review"> & {
	tech_stack_json: string;
	needs_batch_review: 0 | 1;
};

export function createSkillInvocation(db: Db, input: SkillInvocationInput): number {
	const result = db
		.prepare(
			`
				insert into skill_invocations (
					skill_name,
					working_directory,
					tech_stack_json,
					started_at,
					finished_at,
					status
				)
				values (?, ?, ?, ?, ?, ?)
			`
		)
		.run(
			input.skill_name,
			input.working_directory,
			JSON.stringify(input.tech_stack),
			input.started_at,
			input.finished_at ?? null,
			input.status
		);

	return Number(result.lastInsertRowid);
}

export function createFeedbackEvent(db: Db, input: FeedbackInput): number {
	const result = db
		.prepare(
			`
				insert into feedback_events (
					skill_name,
					working_directory,
					tech_stack_json,
					ai_output,
					user_correction_input,
					classification_confidence,
					needs_batch_review,
					created_at
				)
				values (?, ?, ?, ?, ?, ?, ?, ?)
			`
		)
		.run(
			input.skill_name,
			input.working_directory,
			JSON.stringify(input.tech_stack),
			input.ai_output,
			input.user_correction_input,
			input.classification_confidence,
			input.needs_batch_review ? 1 : 0,
			input.created_at
		);

	return Number(result.lastInsertRowid);
}

export function listFeedbackByDateRange(db: Db, from: string, to: string): FeedbackRow[] {
	const rows = db
		.prepare(
			`
				select
					id,
					skill_name,
					working_directory,
					tech_stack_json,
					ai_output,
					user_correction_input,
					classification_confidence,
					needs_batch_review,
					created_at
				from feedback_events
				where created_at >= ? and created_at <= ?
				order by id asc
			`
		)
		.all(from, to) as FeedbackDbRow[];

	return rows.map((row) => ({
		id: row.id,
		skill_name: row.skill_name,
		working_directory: row.working_directory,
		tech_stack: JSON.parse(row.tech_stack_json) as string[],
		ai_output: row.ai_output,
		user_correction_input: row.user_correction_input,
		classification_confidence: row.classification_confidence,
		needs_batch_review: row.needs_batch_review === 1,
		created_at: row.created_at
	}));
}

export function upsertMergeRequest(db: Db, input: MergeRequestInput): number {
	const existing = db.prepare("select id from merge_requests where mr_url = ?").get(input.mr_url) as
		| { id: number }
		| undefined;

	if (existing) {
		db.prepare(
			`
				update merge_requests
				set
					title = ?,
					head_commit_hash = ?,
					iteration_type = ?,
					feedback_id_start = ?,
					feedback_id_end = ?,
					status = ?,
					opened_at = ?,
					merged_at = ?
				where id = ?
			`
		).run(
			input.title,
			input.head_commit_hash,
			input.iteration_type,
			input.feedback_id_start,
			input.feedback_id_end,
			input.status,
			input.opened_at,
			input.merged_at ?? null,
			existing.id
		);

		return existing.id;
	}

	const result = db
		.prepare(
			`
				insert into merge_requests (
					mr_url,
					title,
					head_commit_hash,
					iteration_type,
					feedback_id_start,
					feedback_id_end,
					status,
					opened_at,
					merged_at
				)
				values (?, ?, ?, ?, ?, ?, ?, ?, ?)
			`
		)
		.run(
			input.mr_url,
			input.title,
			input.head_commit_hash,
			input.iteration_type,
			input.feedback_id_start,
			input.feedback_id_end,
			input.status,
			input.opened_at,
			input.merged_at ?? null
		);

	return Number(result.lastInsertRowid);
}

export function updateMergeRequestStatus(db: Db, id: number, input: MergeRequestStatusInput): void {
	db.prepare("update merge_requests set status = ?, merged_at = ? where id = ?").run(
		input.status,
		input.merged_at ?? null,
		id
	);
}

export function getLatestMergeRequest(db: Db): MergeRequestRow | null {
	const row = db
		.prepare("select * from merge_requests order by opened_at desc, id desc limit 1")
		.get() as MergeRequestRow | undefined;

	return row ?? null;
}

export function getMergeRequestById(db: Db, id: number): MergeRequestRow | null {
	const row = db.prepare("select * from merge_requests where id = ?").get(id) as MergeRequestRow | undefined;

	return row ?? null;
}

export function countFeedbackByIdRange(db: Db, feedbackIdStart: number, feedbackIdEnd: number): number {
	const row = db.prepare("select count(*) as count from feedback_events where id >= ? and id <= ?").get(
		feedbackIdStart,
		feedbackIdEnd
	) as { count: number };

	return row.count;
}

export function purgeFeedbackForMergeRequest(db: Db, mergeRequest: MergeRequestRow, purgedAt: string): number {
	if (mergeRequest.iteration_type !== "major") {
		throw new Error("Only major merge requests can purge feedback");
	}

	if (mergeRequest.status !== "merged") {
		throw new Error("Only merged merge requests can purge feedback");
	}

	if (!mergeRequest.merged_at) {
		throw new Error("Merged merge requests must have merged_at before purging feedback");
	}

	if (mergeRequest.purged_at) {
		throw new Error("Merge request feedback was already purged");
	}

	const purge = db.transaction(() => {
		const deletedCount = db
			.prepare("delete from feedback_events where id >= ? and id <= ?")
			.run(mergeRequest.feedback_id_start, mergeRequest.feedback_id_end).changes;

		db.prepare(
			`
				insert into purge_audit_logs (
					merge_request_id,
					feedback_id_start,
					feedback_id_end,
					deleted_count,
					purged_at
				)
				values (?, ?, ?, ?, ?)
			`
		).run(
			mergeRequest.id,
			mergeRequest.feedback_id_start,
			mergeRequest.feedback_id_end,
			deletedCount,
			purgedAt
		);

		db.prepare("update merge_requests set purged_at = ? where id = ?").run(purgedAt, mergeRequest.id);

		return deletedCount;
	});

	return purge();
}
