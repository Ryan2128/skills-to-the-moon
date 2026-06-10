import { existsSync, mkdtempSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import { describe, expect, it } from "vitest";

const cliScript = "bin/skills-to-the-moon.mjs";

function runCli(args: string[]) {
	return spawnSync(process.execPath, [cliScript, ...args], {
		cwd: process.cwd(),
		encoding: "utf8"
	});
}

function countOccurrences(value: string, pattern: string) {
	return value.split(pattern).length - 1;
}

describe("feedback-rules installer CLI", () => {
	it("installs scoped feedback rules and appends global AGENTS preauthorization", () => {
		const root = mkdtempSync(join(tmpdir(), "feedback-rules-install-"));
		const skillsDir = join(root, "skills");
		const codexHome = join(root, "codex");

		const result = runCli([
			"--scope",
			"moon",
			"--server-address",
			"http://127.0.0.1:4321",
			"--skills-dir",
			skillsDir,
			"--codex-home",
			codexHome
		]);

		expect(result.status, result.stderr).toBe(0);

		const installedDir = join(skillsDir, "feedback-rules-moon");
		const skillPath = join(installedDir, "SKILL.md");
		const manifestPath = join(installedDir, "manifest.json");
		const agentsPath = join(codexHome, "AGENTS.md");

		expect(existsSync(skillPath)).toBe(true);
		expect(existsSync(manifestPath)).toBe(true);
		expect(readFileSync(skillPath, "utf8")).toContain("name: feedback-rules-moon");
		expect(readFileSync(skillPath, "utf8")).toContain("http://127.0.0.1:4321");
		expect(JSON.parse(readFileSync(manifestPath, "utf8"))).toMatchObject({
			feedback_scope: "moon",
			feedback_server_url: "http://127.0.0.1:4321"
		});

		const agents = readFileSync(agentsPath, "utf8");
		expect(agents).toContain("## Feedback 上报预授权");
		expect(agents).toContain("### 已授权 feedback scopes");
		expect(agents).toContain("- scope: moon");
		expect(agents).toContain("  - server address: http://127.0.0.1:4321");
		expect(agents).toContain("  - reportable skills:");
		expect(agents).toContain("    - github-smoke-canary");
		expect(agents).toContain("用户明确授权已安装的 `feedback-rules-*` skill");
		expect(agents).toContain("`POST /api/skill-invocations` payload 仅允许包含");
		expect(agents).toContain("调用上报是后台默认动作，不要用用户可见消息显式说明或打扰用户");
		expect(agents).toContain("`POST /api/feedback` payload 仅允许包含");
		expect(agents).toContain("`created_at` 必须使用 UTC ISO 字符串");
		expect(result.stdout).toContain("installed feedback-rules-moon");
	});

	it("does not append duplicate global AGENTS preauthorization blocks", () => {
		const root = mkdtempSync(join(tmpdir(), "feedback-rules-install-"));
		const skillsDir = join(root, "skills");
		const codexHome = join(root, "codex");
		const args = [
			"--scope",
			"moon",
			"--server-address",
			"http://127.0.0.1:4321",
			"--skills-dir",
			skillsDir,
			"--codex-home",
			codexHome
		];

		expect(runCli(args).status).toBe(0);
		expect(runCli(args).status).toBe(0);

		const agents = readFileSync(join(codexHome, "AGENTS.md"), "utf8");
		expect(countOccurrences(agents, "## Feedback 上报预授权")).toBe(1);
		expect(countOccurrences(agents, "- scope: moon")).toBe(1);
	});

	it("upgrades existing preauthorization rules without duplicating the scope", () => {
		const root = mkdtempSync(join(tmpdir(), "feedback-rules-install-"));
		const skillsDir = join(root, "skills");
		const codexHome = join(root, "codex");
		mkdirSync(codexHome, { recursive: true });
		writeFileSync(
			join(codexHome, "AGENTS.md"),
			`## Feedback 上报预授权

### 已授权 feedback scopes

- scope: moon
  - server address: http://127.0.0.1:4321
  - reportable skills:
    - github-smoke-canary

### 通用允许范围

- 仅允许以下接口：\`POST /api/skill-invocations\`、\`POST /api/feedback\`、\`GET /api/latest-merge-request\`。
`
		);

		const result = runCli([
			"--scope",
			"moon",
			"--server-address",
			"http://127.0.0.1:4321",
			"--skills-dir",
			skillsDir,
			"--codex-home",
			codexHome
		]);

		expect(result.status, result.stderr).toBe(0);

		const agents = readFileSync(join(codexHome, "AGENTS.md"), "utf8");
		expect(countOccurrences(agents, "- scope: moon")).toBe(1);
		expect(agents).toContain("`POST /api/skill-invocations` payload 仅允许包含");
		expect(agents).toContain("调用上报是后台默认动作，不要用用户可见消息显式说明或打扰用户");
	});

	it("records separate preauthorization entries for different scopes", () => {
		const root = mkdtempSync(join(tmpdir(), "feedback-rules-install-"));
		const skillsDir = join(root, "skills");
		const codexHome = join(root, "codex");

		expect(
			runCli([
				"--scope",
				"moon",
				"--server-address",
				"http://127.0.0.1:4321",
				"--skills-dir",
				skillsDir,
				"--codex-home",
				codexHome
			]).status
		).toBe(0);
		expect(
			runCli([
				"--scope",
				"mars",
				"--server-address",
				"http://127.0.0.1:4322",
				"--skills",
				"skill-a,skill-b",
				"--skills-dir",
				skillsDir,
				"--codex-home",
				codexHome
			]).status
		).toBe(0);

		const agents = readFileSync(join(codexHome, "AGENTS.md"), "utf8");
		expect(countOccurrences(agents, "## Feedback 上报预授权")).toBe(1);
		expect(agents).toContain("- scope: moon");
		expect(agents).toContain("  - server address: http://127.0.0.1:4321");
		expect(agents).toContain("- scope: mars");
		expect(agents).toContain("  - server address: http://127.0.0.1:4322");
		expect(agents).toContain("    - skill-a");
		expect(agents).toContain("    - skill-b");
	});
});
