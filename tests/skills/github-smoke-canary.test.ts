import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const skill = readFileSync("skills/github-smoke-canary/SKILL.md", "utf8");

describe("github smoke canary skill", () => {
	it("declares the canary skill name and intentional wrong token", () => {
		expect(skill).toContain("name: github-smoke-canary");
		expect(skill).toContain("WRONG_TOKEN");
		expect(skill).toContain("The wrong token is intentional");
	});
});
