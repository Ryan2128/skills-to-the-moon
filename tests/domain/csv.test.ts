import { describe, expect, it } from "vitest";

import { toCsv } from "../../src/server/domain/csv.js";

describe("toCsv", () => {
	it("escapes commas, quotes and newlines", () => {
		const csv = toCsv(
			["id", "text"],
			[
				{ id: 1, text: "hello, world" },
				{ id: 2, text: 'quote "inside"' },
				{ id: 3, text: "line\nbreak" }
			]
		);

		expect(csv).toBe(["id,text", '1,"hello, world"', '2,"quote ""inside"""', '3,"line\nbreak"'].join("\n"));
	});
});
