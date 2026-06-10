export type ParsedMergeRequestTitle = {
	iteration_type: "minor" | "major";
	feedback_id_start: number;
	feedback_id_end: number;
};

const titlePattern = /^\[skills-feedback\]\[(minor|major)\]\[feedback:(\d+)-(\d+)\]\s+.+$/;

export function parseMergeRequestTitle(title: string): ParsedMergeRequestTitle {
	const match = title.match(titlePattern);

	if (!match) {
		throw new Error("Invalid skills feedback MR title");
	}

	const feedback_id_start = Number(match[2]);
	const feedback_id_end = Number(match[3]);

	if (feedback_id_start > feedback_id_end) {
		throw new Error("feedback_id_start must be less than or equal to feedback_id_end");
	}

	return {
		iteration_type: match[1] as "minor" | "major",
		feedback_id_start,
		feedback_id_end
	};
}
