import { readFileSync } from "node:fs";

const skill = readFileSync("skills/feedback-rules/SKILL.md", "utf8");

const requiredPhrases = [
	"本 skill 不计入反馈统计",
	"不得把本 skill 作为 skill_name 上报",
	"confidence >= 0.8",
	"0.6 <= confidence < 0.8",
	"confidence < 0.6",
	"只上报用户纠错指向的真实业务 skill",
	"没有调用 skill 的普通对话不上报",
	"GET /api/latest-merge-request"
];

const missing = requiredPhrases.filter((phrase) => !skill.includes(phrase));

if (missing.length > 0) {
	console.error(`feedback-rules skill missing required phrases:\n${missing.join("\n")}`);
	process.exit(1);
}

console.log("feedback-rules skill validation passed");
