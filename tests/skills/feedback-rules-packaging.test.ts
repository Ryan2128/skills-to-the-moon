import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const packageScript = "scripts/package-feedback-rules.mjs";

function runPackager(args: string[]) {
	return spawnSync(process.execPath, [packageScript, ...args], {
		cwd: process.cwd(),
		encoding: "utf8"
	});
}

describe("feedback-rules packager", () => {
	it("keeps the source skill as a scoped template", () => {
		const template = readFileSync("templates/feedback-rules/SKILL.md", "utf8");

		expect(template).toContain("name: feedback-rules-${scope}");
		expect(template).toContain("`feedback-rules-${scope}`");
		expect(template).not.toContain("name: feedback-rules\n");
	});

	it("packages a scoped feedback-rules skill with server URL and reportable skills", () => {
		const outDir = mkdtempSync(join(tmpdir(), "feedback-rules-package-"));
		const result = runPackager([
			"--scope",
			"moon",
			"--server-url",
			"http://127.0.0.1:4321",
			"--skills",
			"skill-a,superpowers:brainstorming",
			"--out-dir",
			outDir
		]);

		expect(result.status).toBe(0);

		const packageDir = join(outDir, "feedback-rules-moon");
		const skill = readFileSync(join(packageDir, "SKILL.md"), "utf8");
		const examples = readFileSync(join(packageDir, "EXAMPLES.md"), "utf8");
		const manifest = JSON.parse(readFileSync(join(packageDir, "manifest.json"), "utf8")) as {
			feedback_scope: string;
			feedback_server_url: string;
			reportable_skills: string[];
		};

		expect(skill).toContain("name: feedback-rules-moon");
		expect(skill).toContain("`feedback-rules-moon`");
		expect(skill).toContain("http://127.0.0.1:4321");
		expect(skill).toContain("- `skill-a`");
		expect(skill).toContain("- `superpowers:brainstorming`");
		expect(skill).toContain("只处理 `reportable_skills` 列表内 skill 的纠错");
		expect(skill).toContain("如果多个 `feedback-rules-*` 同时声明同一个业务 skill，则视为配置冲突，不上报");
		expect(skill).not.toContain("${scope}");
		expect(skill).not.toContain("${server_url}");
		expect(skill).not.toContain("${reportable_skills}");
		expect(examples).toContain("feedback-rules-moon");
		expect(manifest).toEqual({
			feedback_scope: "moon",
			feedback_server_url: "http://127.0.0.1:4321",
			reportable_skills: ["skill-a", "superpowers:brainstorming"]
		});
	});

	it("accepts the argument separator forwarded by pnpm scripts", () => {
		const outDir = mkdtempSync(join(tmpdir(), "feedback-rules-package-"));
		const result = runPackager([
			"--",
			"--scope",
			"moon",
			"--server-url",
			"http://127.0.0.1:4321",
			"--skills",
			"skill-a",
			"--out-dir",
			outDir
		]);

		expect(result.status).toBe(0);
		expect(readFileSync(join(outDir, "feedback-rules-moon", "SKILL.md"), "utf8")).toContain(
			"name: feedback-rules-moon"
		);
	});

	it("packages reportable skills from a skills file", () => {
		const outDir = mkdtempSync(join(tmpdir(), "feedback-rules-package-"));
		const skillsFile = join(outDir, "skills.json");
		writeFileSync(skillsFile, JSON.stringify({ skills: ["skill-a", "skill-b"] }));

		const result = runPackager([
			"--scope",
			"moon",
			"--server-url",
			"http://127.0.0.1:4321",
			"--skills-file",
			skillsFile,
			"--out-dir",
			outDir
		]);

		expect(result.status).toBe(0);

		const manifest = JSON.parse(readFileSync(join(outDir, "feedback-rules-moon", "manifest.json"), "utf8")) as {
			reportable_skills: string[];
		};
		expect(manifest.reportable_skills).toEqual(["skill-a", "skill-b"]);
	});

	it("rejects unsafe scopes, server URLs, and feedback-rules skills", () => {
		const outDir = mkdtempSync(join(tmpdir(), "feedback-rules-package-"));

		const invalidScope = runPackager([
			"--scope",
			"bad_scope",
			"--server-url",
			"http://127.0.0.1:4321",
			"--skills",
			"skill-a",
			"--out-dir",
			outDir
		]);
		expect(invalidScope.status).not.toBe(0);
		expect(invalidScope.stderr).toContain("scope");

		const unsafeUrl = runPackager([
			"--scope",
			"moon",
			"--server-url",
			"http://0.0.0.0:4321",
			"--skills",
			"skill-a",
			"--out-dir",
			outDir
		]);
		expect(unsafeUrl.status).not.toBe(0);
		expect(unsafeUrl.stderr).toContain("0.0.0.0");

		const urlWithQuery = runPackager([
			"--scope",
			"moon",
			"--server-url",
			"http://127.0.0.1:4321?token=bad",
			"--skills",
			"skill-a",
			"--out-dir",
			outDir
		]);
		expect(urlWithQuery.status).not.toBe(0);
		expect(urlWithQuery.stderr).toContain("query");

		const urlWithHash = runPackager([
			"--scope",
			"moon",
			"--server-url",
			"http://127.0.0.1:4321#section",
			"--skills",
			"skill-a",
			"--out-dir",
			outDir
		]);
		expect(urlWithHash.status).not.toBe(0);
		expect(urlWithHash.stderr).toContain("hash");

		const fixedFeedbackSkill = runPackager([
			"--scope",
			"moon",
			"--server-url",
			"http://127.0.0.1:4321",
			"--skills",
			"feedback-rules",
			"--out-dir",
			outDir
		]);
		expect(fixedFeedbackSkill.status).not.toBe(0);
		expect(fixedFeedbackSkill.stderr).toContain("reportable skills");

		const scopedFeedbackSkill = runPackager([
			"--scope",
			"moon",
			"--server-url",
			"http://127.0.0.1:4321",
			"--skills",
			"feedback-rules-moon",
			"--out-dir",
			outDir
		]);
		expect(scopedFeedbackSkill.status).not.toBe(0);
		expect(scopedFeedbackSkill.stderr).toContain("reportable skills");

		const emptySkills = runPackager([
			"--scope",
			"moon",
			"--server-url",
			"http://127.0.0.1:4321",
			"--skills",
			",",
			"--out-dir",
			outDir
		]);
		expect(emptySkills.status).not.toBe(0);
		expect(emptySkills.stderr).toContain("reportable skills must not be empty");
	});
});
