import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const template = readFileSync("templates/feedback-rules/SKILL.md", "utf8");

const requiredTemplatePhrases = [
	"name: feedback-rules-${scope}",
	"`feedback-rules-${scope}`",
	"本 skill 不计入反馈统计",
	"不得把本 skill 作为 skill_name 上报",
	"不得把任何 `feedback-rules-*` skill 作为 skill_name 上报",
	"confidence >= 0.8",
	"0.6 <= confidence < 0.8",
	"confidence < 0.6",
	"只上报用户纠错指向的真实业务 skill",
	"没有调用 skill 的普通对话不上报",
	"${server_url}",
	"${reportable_skills_yaml}",
	"POST /api/skill-invocations",
	"POST /api/feedback",
	"不得使用 `0.0.0.0` 作为请求目标",
	"GET /api/latest-merge-request"
];

const missingTemplatePhrases = requiredTemplatePhrases.filter((phrase) => !template.includes(phrase));

if (missingTemplatePhrases.length > 0) {
	console.error(`feedback-rules template missing required phrases:\n${missingTemplatePhrases.join("\n")}`);
	process.exit(1);
}

const outDir = mkdtempSync(join(tmpdir(), "feedback-rules-validation-"));
const packageResult = spawnSync(
	process.execPath,
	[
		"scripts/package-feedback-rules.mjs",
		"--scope",
		"validation",
		"--server-url",
		"http://127.0.0.1:4321",
		"--skills",
		"validation-skill",
		"--out-dir",
		outDir
	],
	{ encoding: "utf8" }
);

if (packageResult.status !== 0) {
	console.error(packageResult.stderr);
	process.exit(packageResult.status ?? 1);
}

const generatedSkill = readFileSync(join(outDir, "feedback-rules-validation", "SKILL.md"), "utf8");
const requiredGeneratedPhrases = [
	"name: feedback-rules-validation",
	"`feedback-rules-validation`",
	"http://127.0.0.1:4321",
	"- `validation-skill`",
	"只处理 `reportable_skills` 列表内 skill 的纠错"
];
const missingGeneratedPhrases = requiredGeneratedPhrases.filter((phrase) => !generatedSkill.includes(phrase));

if (missingGeneratedPhrases.length > 0) {
	console.error(`generated feedback-rules skill missing required phrases:\n${missingGeneratedPhrases.join("\n")}`);
	process.exit(1);
}

if (generatedSkill.includes("${")) {
	console.error("generated feedback-rules skill still contains unresolved placeholders");
	process.exit(1);
}

console.log("feedback-rules skill validation passed");
