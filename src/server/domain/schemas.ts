import { z } from "zod";

const isoDateTime = z.iso.datetime();
const nonEmptyString = z.string().min(1);
const positiveInteger = z.number().int().positive();
const httpUrl = z.url().refine(
	(value) => {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	},
	{ message: "URL must use http or https" }
);

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
		status: z.enum(["open", "merged", "closed"]),
		opened_at: isoDateTime,
		merged_at: isoDateTime.optional().nullable()
	})
	.refine((value) => value.feedback_id_start <= value.feedback_id_end, {
		message: "feedback_id_start must be less than or equal to feedback_id_end",
		path: ["feedback_id_end"]
	});

export const mergeRequestStatusInputSchema = z.object({
	status: z.enum(["open", "merged", "closed"]),
	merged_at: isoDateTime.optional().nullable()
});

export type SkillInvocationInput = z.infer<typeof skillInvocationInputSchema>;
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type MergeRequestInput = z.infer<typeof mergeRequestInputSchema>;
export type MergeRequestStatusInput = z.infer<typeof mergeRequestStatusInputSchema>;
