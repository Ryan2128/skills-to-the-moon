#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const templateDir = join(repoRoot, "templates", "feedback-rules");

function fail(message) {
	console.error(`package-feedback-rules: ${message}`);
	process.exit(1);
}

function parseArgs(rawArgs) {
	const options = {};

	for (let index = 0; index < rawArgs.length; index += 1) {
		const arg = rawArgs[index];

		if (arg === "--") {
			continue;
		}

		if (!arg.startsWith("--")) {
			fail(`unexpected argument: ${arg}`);
		}

		const key = arg.slice(2);
		const value = rawArgs[index + 1];

		if (!value || value.startsWith("--")) {
			fail(`missing value for --${key}`);
		}

		options[key] = value;
		index += 1;
	}

	return options;
}

function requireOption(options, key) {
	const value = options[key];

	if (!value) {
		fail(`missing required --${key}`);
	}

	return value;
}

function validateScope(scope) {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(scope)) {
		fail("scope must use lowercase letters, numbers, and single hyphens");
	}
}

function validateServerUrl(value) {
	let url;

	try {
		url = new URL(value);
	} catch {
		fail("server-url must be a valid URL");
	}

	if (url.protocol !== "http:" && url.protocol !== "https:") {
		fail("server-url must use http or https");
	}

	if (url.hostname === "0.0.0.0") {
		fail("server-url must not use 0.0.0.0 as request target");
	}

	if (url.search) {
		fail("server-url must not include query parameters");
	}

	if (url.hash) {
		fail("server-url must not include hash fragments");
	}

	return url.toString().replace(/\/$/, "");
}

function readSkillsFile(path) {
	let parsed;

	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error) {
		fail(`failed to read skills-file: ${error instanceof Error ? error.message : "unknown error"}`);
	}

	if (Array.isArray(parsed)) {
		return parsed;
	}

	if (parsed && Array.isArray(parsed.skills)) {
		return parsed.skills;
	}

	fail("skills-file must be a JSON array or an object with a skills array");
}

function parseSkills(options) {
	const inlineSkills = options.skills
		? options.skills
				.split(",")
				.map((skill) => skill.trim())
				.filter(Boolean)
		: [];
	const fileSkills = options["skills-file"] ? readSkillsFile(options["skills-file"]) : [];
	const skills = [...inlineSkills, ...fileSkills].map((skill) => {
		if (typeof skill !== "string") {
			fail("reportable skills must be strings");
		}

		return skill.trim();
	});
	const uniqueSkills = [...new Set(skills.filter(Boolean))];

	if (uniqueSkills.length === 0) {
		fail("reportable skills must not be empty");
	}

	for (const skill of uniqueSkills) {
		if (skill.includes("\n") || skill.includes("\r")) {
			fail("reportable skills must be single-line strings");
		}

		if (/^feedback-rules(?:-.+)?$/.test(skill)) {
			fail("reportable skills must not include feedback-rules skills");
		}
	}

	return uniqueSkills;
}

function renderTemplate(template, values) {
	return Object.entries(values).reduce(
		(result, [key, value]) => result.replaceAll(`\${${key}}`, value),
		template
	);
}

const options = parseArgs(process.argv.slice(2));
const scope = requireOption(options, "scope");
const serverUrl = validateServerUrl(requireOption(options, "server-url"));
const outRoot = options["out-dir"] ?? join(repoRoot, "dist", "feedback-rules-packages");
const skills = parseSkills(options);

validateScope(scope);

const packageName = `feedback-rules-${scope}`;
const packageDir = join(outRoot, packageName);
const values = {
	scope,
	server_url: serverUrl,
	reportable_skills_markdown: skills.map((skill) => `- \`${skill}\``).join("\n"),
	reportable_skills_yaml: skills.map((skill) => `  - ${JSON.stringify(skill)}`).join("\n"),
	first_reportable_skill: skills[0]
};

rmSync(packageDir, { force: true, recursive: true });
mkdirSync(packageDir, { recursive: true });

for (const fileName of ["SKILL.md", "EXAMPLES.md"]) {
	const template = readFileSync(join(templateDir, fileName), "utf8");
	writeFileSync(join(packageDir, fileName), renderTemplate(template, values));
}

writeFileSync(
	join(packageDir, "manifest.json"),
	`${JSON.stringify(
		{
			feedback_scope: scope,
			feedback_server_url: serverUrl,
			reportable_skills: skills
		},
		null,
		2
	)}\n`
);

console.log(`packaged ${packageName} at ${packageDir}`);
