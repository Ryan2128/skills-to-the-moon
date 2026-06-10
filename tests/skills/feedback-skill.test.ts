import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const skill = readFileSync("skills/feedback-rules/SKILL.md", "utf8");

describe("feedback rules skill", () => {
	it("declares self-exemption", () => {
		expect(skill).toContain("本 skill 不计入反馈统计");
		expect(skill).toContain("不得把本 skill 作为 skill_name 上报");
	});

	it("contains confidence thresholds", () => {
		expect(skill).toContain("confidence >= 0.8");
		expect(skill).toContain("0.6 <= confidence < 0.8");
		expect(skill).toContain("confidence < 0.6");
	});

	it("requires reporting only corrected real business skills", () => {
		expect(skill).toContain("只上报用户纠错指向的真实业务 skill");
		expect(skill).toContain("没有调用 skill 的普通对话不上报");
	});
});
