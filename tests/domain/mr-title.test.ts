import { describe, expect, it } from "vitest";

import { parseMergeRequestTitle } from "../../src/server/domain/mr-title.js";

describe("parseMergeRequestTitle", () => {
	it("parses a minor feedback title", () => {
		expect(parseMergeRequestTitle("[skills-feedback][minor][feedback:1200-1488] 2026-06-17 skill updates")).toEqual({
			iteration_type: "minor",
			feedback_id_start: 1200,
			feedback_id_end: 1488
		});
	});

	it("parses a major feedback title", () => {
		expect(parseMergeRequestTitle("[skills-feedback][major][feedback:1200-1850] 2026-07-08 skill review")).toEqual({
			iteration_type: "major",
			feedback_id_start: 1200,
			feedback_id_end: 1850
		});
	});

	it("rejects invalid titles", () => {
		expect(() => parseMergeRequestTitle("skill updates")).toThrow("Invalid skills feedback MR title");
	});

	it("rejects reversed feedback ranges", () => {
		expect(() => parseMergeRequestTitle("[skills-feedback][minor][feedback:9-2] invalid")).toThrow(
			"feedback_id_start must be less than or equal to feedback_id_end"
		);
	});
});
