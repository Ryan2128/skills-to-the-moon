import { z } from "zod";

const isoDateTime = z.iso.datetime();
const nonEmptyString = z.string().min(1);
const positiveInteger = z.number().int().positive();
const mergeRequestStatus = z.enum(["open", "merged", "closed"]);
const httpUrl = z.url().refine(
	(value) => {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	},
	{ message: "URL must use http or https" }
);

function hasConsistentMergedAt(value: {
	status: "open" | "merged" | "closed";
	merged_at?: string | null;
}): boolean {
	if (value.status === "merged") {
		return Boolean(value.merged_at);
	}

	return !value.merged_at;
}

const mergedAtConsistencyError = {
	message: "merged status requires merged_at and non-merged status must not set merged_at",
	path: ["merged_at"]
};

export const skillInvocationInputSchema = z.object({
	skill_name: nonEmptyString,
	working_directory: nonEmptyString,
	tech_stack: z.array(nonEmptyString),
	started_at: isoDateTime,
	finished_at: isoDateTime.optional().nullable(),
	status: z.enum(["success", "failed", "unknown"])
});

export const feedbackInputSchema = z.object({
	skill_name: nonEmptyString,
	working_directory: nonEmptyString,
	tech_stack: z.array(nonEmptyString),
	ai_output: nonEmptyString,
	user_correction_input: nonEmptyString,
	classification_confidence: z.number().min(0).max(1),
	needs_batch_review: z.boolean(),
	created_at: isoDateTime
});

export const mergeRequestInputSchema = z
	.object({
		mr_url: httpUrl,
		title: nonEmptyString,
		head_commit_hash: nonEmptyString,
		iteration_type: z.enum(["minor", "major"]),
		feedback_id_start: positiveInteger,
		feedback_id_end: positiveInteger,
		status: mergeRequestStatus,
		opened_at: isoDateTime,
		merged_at: isoDateTime.optional().nullable()
	})
	.refine((value) => value.feedback_id_start <= value.feedback_id_end, {
		message: "feedback_id_start must be less than or equal to feedback_id_end",
		path: ["feedback_id_end"]
	})
	.refine(hasConsistentMergedAt, mergedAtConsistencyError);

export const mergeRequestStatusInputSchema = z
	.object({
		status: mergeRequestStatus,
		merged_at: isoDateTime.optional().nullable()
	})
	.refine(hasConsistentMergedAt, mergedAtConsistencyError);

export type SkillInvocationInput = z.infer<typeof skillInvocationInputSchema>;
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type MergeRequestInput = z.infer<typeof mergeRequestInputSchema>;
export type MergeRequestStatusInput = z.infer<typeof mergeRequestStatusInputSchema>;
