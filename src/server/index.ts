import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { buildApp } from "./app.js";
import { createDatabase } from "./db/connection.js";
import { runMigrations } from "./db/schema.js";

const databasePath = process.env.SKILLS_FEEDBACK_DB ?? "data/skills-feedback.sqlite";
mkdirSync(dirname(databasePath), { recursive: true });

const db = createDatabase(databasePath);
runMigrations(db);

const app = buildApp({ db, adminToken: process.env.SKILLS_FEEDBACK_ADMIN_TOKEN });
const port = Number(process.env.PORT ?? 4321);
const host = process.env.HOST ?? "127.0.0.1";

await app.listen({ host, port });
console.log(`skills feedback server listening on http://${host}:${port}`);
