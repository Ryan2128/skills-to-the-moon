import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const skillTemplate = readFileSync("templates/feedback-rules/SKILL.md", "utf8");

describe("feedback rules skill template", () => {
	it("declares self-exemption", () => {
		expect(skillTemplate).toContain("name: feedback-rules-${scope}");
		expect(skillTemplate).toContain("本 skill 不计入反馈统计");
		expect(skillTemplate).toContain("不得把本 skill 作为 skill_name 上报");
		expect(skillTemplate).toContain("不得把任何 `feedback-rules-*` skill 作为 skill_name 上报");
	});

	it("contains confidence thresholds", () => {
		expect(skillTemplate).toContain("confidence >= 0.8");
		expect(skillTemplate).toContain("0.6 <= confidence < 0.8");
		expect(skillTemplate).toContain("confidence < 0.6");
	});

	it("requires reporting only corrected real business skills", () => {
		expect(skillTemplate).toContain("只上报用户纠错指向的真实业务 skill");
		expect(skillTemplate).toContain("没有调用 skill 的普通对话不上报");
		expect(skillTemplate).toContain("纠错指向非白名单 skill 时不上报");
	});

	it("declares packaged feedback server request address and endpoints", () => {
		expect(skillTemplate).toContain("${server_url}");
		expect(skillTemplate).toContain("POST /api/skill-invocations");
		expect(skillTemplate).toContain("POST /api/feedback");
		expect(skillTemplate).toContain("不得使用 `0.0.0.0` 作为请求目标");
	});

	it("requires reporting business skill invocations", () => {
		expect(skillTemplate).toContain("## Skill 调用上报");
		expect(skillTemplate).toContain("一旦本轮选择、读取或执行了 `reportable_skills` 列表内的真实业务 skill");
		expect(skillTemplate).toContain("必须向 `${server_url}/api/skill-invocations` 上报一次调用事件");
		expect(skillTemplate).toContain("调用上报是后台默认动作，不要用用户可见消息显式说明或打扰用户");
		expect(skillTemplate).toContain("`POST /api/skill-invocations` 的 payload 仅允许包含");
		expect(skillTemplate).toContain("`started_at`：必须使用 UTC ISO 字符串");
		expect(skillTemplate).toContain("`status`：`success`、`failed` 或 `unknown`");
	});

	it("declares exact feedback payload parameter rules", () => {
		expect(skillTemplate).toContain("`POST /api/feedback` 的 payload 仅允许包含");
		expect(skillTemplate).toContain("`tech_stack` 必须是字符串数组");
		expect(skillTemplate).toContain("无法识别时使用 `[\"unknown\"]`");
		expect(skillTemplate).toContain("`created_at` 必须使用 UTC ISO 字符串");
		expect(skillTemplate).toContain("new Date().toISOString()");
	});
});
