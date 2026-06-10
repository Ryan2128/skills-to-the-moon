import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

import { describe, expect, it } from "vitest";

const cliScript = "bin/skills-to-the-moon.mjs";

type LatestMergeRequest = {
	id: number;
	mr_url: string;
	title: string;
	head_commit_hash: string;
	iteration_type: "minor" | "major";
	feedback_id_start: number;
	feedback_id_end: number;
	status: "open" | "merged" | "closed";
	opened_at: string;
	merged_at: string | null;
	purged_at: string | null;
};

function runCli(args: string[]) {
	return new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
		const child = spawn(process.execPath, [cliScript, ...args], {
			cwd: process.cwd(),
			stdio: ["ignore", "pipe", "pipe"]
		});

		const stdout: Buffer[] = [];
		const stderr: Buffer[] = [];

		child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
		child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
		child.on("close", (status) => {
			resolve({
				status,
				stdout: Buffer.concat(stdout).toString("utf8"),
				stderr: Buffer.concat(stderr).toString("utf8")
			});
		});
	});
}

async function writeSkill(root: string, name: string, body: string) {
	const skillDir = join(root, "skills", name);
	await mkdir(skillDir, { recursive: true });
	writeFileSync(
		join(skillDir, "SKILL.md"),
		`---
name: ${name}
description: Use when testing sync-upgrades for ${name}.
---

# ${name}

${body}
`
	);
}

function latestMergeRequest(overrides: Partial<LatestMergeRequest> = {}): LatestMergeRequest {
	return {
		id: 1,
		mr_url: "https://github.com/Ryan2128/skills-to-the-moon/pull/1",
		title: "[skills-feedback][minor][feedback:1-2] 2026-06-11 skill updates",
		head_commit_hash: "abc123",
		iteration_type: "minor",
		feedback_id_start: 1,
		feedback_id_end: 2,
		status: "merged",
		opened_at: "2026-06-10T18:56:17.000Z",
		merged_at: "2026-06-10T18:58:29.000Z",
		purged_at: null,
		...overrides
	};
}

describe("sync-upgrades CLI", () => {
	it("installs all source skills and records last-seen hash after a merged upgrade", async () => {
		const root = mkdtempSync(join(tmpdir(), "sync-upgrades-"));
		const sourceRoot = join(root, "repo");
		const skillsDir = join(root, "installed-skills");
		const stateDir = join(root, "state");
		const latestFile = join(root, "latest.json");

		await writeSkill(sourceRoot, "skill-a", "new skill a");
		await writeSkill(sourceRoot, "skill-b", "new skill b");
		writeFileSync(latestFile, JSON.stringify(latestMergeRequest()));

		const result = await runCli([
			"sync-upgrades",
			"--scope",
			"moon",
			"--server-address",
			"http://127.0.0.1:4321",
			"--latest-mr-file",
			latestFile,
			"--source-dir",
			sourceRoot,
			"--skills-dir",
			skillsDir,
			"--state-dir",
			stateDir
		]);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain("installed 2 skills");
		expect(readFileSync(join(skillsDir, "skill-a", "SKILL.md"), "utf8")).toContain("new skill a");
		expect(readFileSync(join(skillsDir, "skill-b", "SKILL.md"), "utf8")).toContain("new skill b");
		expect(readFileSync(join(stateDir, "moon.last-seen"), "utf8")).toBe("abc123\n");
	});

	it("skips installation when latest hash was already recorded", async () => {
		const root = mkdtempSync(join(tmpdir(), "sync-upgrades-"));
		const sourceRoot = join(root, "repo");
		const skillsDir = join(root, "installed-skills");
		const stateDir = join(root, "state");
		const latestFile = join(root, "latest.json");
		await mkdir(stateDir, { recursive: true });
		writeFileSync(join(stateDir, "moon.last-seen"), "abc123\n");
		await writeSkill(sourceRoot, "skill-a", "new skill a");
		writeFileSync(latestFile, JSON.stringify(latestMergeRequest()));

		const result = await runCli([
			"sync-upgrades",
			"--scope",
			"moon",
			"--server-address",
			"http://127.0.0.1:4321",
			"--latest-mr-file",
			latestFile,
			"--source-dir",
			sourceRoot,
			"--skills-dir",
			skillsDir,
			"--state-dir",
			stateDir
		]);

		expect(result.status, result.stderr).toBe(0);
		expect(result.stdout).toContain("no new skill upgrade");
		expect(existsSync(join(skillsDir, "skill-a"))).toBe(false);
	});

	it("does not install skills or record last-seen hash for an unmerged upgrade", async () => {
		const root = mkdtempSync(join(tmpdir(), "sync-upgrades-"));
		const sourceRoot = join(root, "repo");
		const skillsDir = join(root, "installed-skills");
		const stateDir = join(root, "state");
		const latestFile = join(root, "latest.json");
		await writeSkill(sourceRoot, "skill-a", "new skill a");
		writeFileSync(latestFile, JSON.stringify(latestMergeRequest({ status: "open", merged_at: null })));

		const result = await runCli([
			"sync-upgrades",
			"--scope",
			"moon",
			"--server-address",
			"http://127.0.0.1:4321",
			"--latest-mr-file",
			latestFile,
			"--source-dir",
			sourceRoot,
			"--skills-dir",
			skillsDir,
			"--state-dir",
			stateDir
		]);

		expect(result.status).toBe(1);
		expect(result.stderr).toContain("latest merge request is not merged");
		expect(existsSync(join(skillsDir, "skill-a"))).toBe(false);
		expect(existsSync(join(stateDir, "moon.last-seen"))).toBe(false);
	});
});
