# Feedback Server Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立第一阶段可运行闭环：feedback skill 协议、反馈 server 数据面、监控页面、CSV 导出、MR 元信息记录和合并后清理入口。

**Architecture:** 使用一个 TypeScript Node 服务承载 API 和简单网页。Fastify 负责 HTTP 路由，SQLite 保存 skill 调用、纠错反馈、MR 元信息和清理审计，核心业务逻辑放在可单测的纯函数和 repository 中。

**Tech Stack:** TypeScript、Node.js、Fastify、SQLite、better-sqlite3、Zod、Vitest、tsx、pnpm。

---

## 范围

本计划实现设计文档的第一阶段：

- feedback skill 规则文件。
- server 数据模型和 SQLite schema。
- `POST /api/skill-invocations`。
- `POST /api/feedback`。
- `GET /api/feedback.csv`。
- `GET /api/latest-merge-request`。
- `POST /api/merge-requests`。
- `PATCH /api/merge-requests/:id/status`。
- `POST /api/admin/merge-requests/:id/purge`。
- `/` 监控页面。
- `/admin` 系统管理页面。

本计划不实现 Agent 云任务中的 AI 归纳、分支创建、MR 创建，也不实现用户本地自动化。那两个子系统在独立计划中实现。

## 文件结构

创建或修改以下文件：

- Create: `package.json`  
  根包配置、脚本和依赖入口。
- Create: `tsconfig.json`  
  TypeScript 编译配置。
- Create: `.gitignore`  
  忽略依赖、构建产物和本地数据库。
- Create: `src/server/index.ts`  
  服务启动入口。
- Create: `src/server/app.ts`  
  Fastify app 构造函数和路由挂载。
- Create: `src/server/db/connection.ts`  
  SQLite 连接工厂。
- Create: `src/server/db/schema.ts`  
  schema migration。
- Create: `src/server/domain/schemas.ts`  
  Zod 输入校验。
- Create: `src/server/domain/repositories.ts`  
  数据读写函数。
- Create: `src/server/domain/mr-title.ts`  
  MR 标题解析。
- Create: `src/server/domain/csv.ts`  
  CSV 生成和转义。
- Create: `src/server/domain/stats.ts`  
  监控统计聚合。
- Create: `src/server/web/layout.ts`  
  HTML 布局函数。
- Create: `src/server/web/dashboard.ts`  
  监控页面渲染。
- Create: `src/server/web/admin.ts`  
  系统管理页面渲染。
- Create: `skills/feedback-rules/SKILL.md`  
  feedback skill 注入规则。
- Create: `skills/feedback-rules/EXAMPLES.md`  
  feedback skill 示例。
- Create: `scripts/validate-feedback-skill.mjs`  
  校验 feedback skill 关键规则是否存在。
- Create: `tests/db/schema.test.ts`  
  schema 测试。
- Create: `tests/domain/mr-title.test.ts`  
  MR 标题解析测试。
- Create: `tests/domain/csv.test.ts`  
  CSV 转义测试。
- Create: `tests/domain/stats.test.ts`  
  监控聚合测试。
- Create: `tests/api/feedback-api.test.ts`  
  调用、反馈、CSV API 测试。
- Create: `tests/api/merge-request-api.test.ts`  
  MR 元信息和清理 API 测试。
- Create: `tests/web/pages.test.ts`  
  监控和管理页面测试。
- Create: `tests/skills/feedback-skill.test.ts`  
  feedback skill 文件校验测试。

## Task 1: 项目脚手架

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: 申请依赖安装审批**

执行前先向用户请求审批，因为本任务会安装新依赖。审批通过后在仓库根目录运行：

```bash
pnpm add fastify better-sqlite3 zod
pnpm add -D @types/better-sqlite3 @types/node tsx typescript vitest
```

Expected: `package.json` 和 lockfile 被 pnpm 创建或更新。

- [ ] **Step 2: 写入 package.json**

Create `package.json`:

```json
{
  "name": "skills-to-the-moon",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/src/server/index.js",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "validate:feedback-skill": "node scripts/validate-feedback-skill.mjs"
  },
  "dependencies": {
    "better-sqlite3": "^11.10.0",
    "fastify": "^5.3.3",
    "zod": "^3.25.67"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22.15.32",
    "tsx": "^4.20.3",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 3: 写入 tsconfig.json**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node", "vitest"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"],
  "exclude": ["dist", "node_modules"]
}
```

- [ ] **Step 4: 写入 .gitignore**

Create `.gitignore`:

```gitignore
node_modules/
dist/
.env
.DS_Store
data/*.sqlite
data/*.sqlite-shm
data/*.sqlite-wal
```

- [ ] **Step 5: 运行基础验证**

Run:

```bash
pnpm run typecheck
```

Expected: 目前还没有源码，命令可能输出 `No inputs were found` 或通过。若因为依赖尚未安装失败，先确认 Step 1 是否已经执行成功。

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json .gitignore
git commit -m "chore: 初始化 TypeScript 服务脚手架"
```

## Task 2: SQLite 连接和 schema

**Files:**

- Create: `src/server/db/connection.ts`
- Create: `src/server/db/schema.ts`
- Test: `tests/db/schema.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/db/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";

describe("database schema", () => {
  it("creates all required tables", () => {
    const db = createDatabase(":memory:");
    runMigrations(db);

    const tables = db
      .prepare("select name from sqlite_master where type = 'table' order by name")
      .all()
      .map((row) => (row as { name: string }).name);

    expect(tables).toEqual([
      "feedback_events",
      "merge_requests",
      "purge_audit_logs",
      "skill_invocations"
    ]);
  });

  it("enforces merge request status values", () => {
    const db = createDatabase(":memory:");
    runMigrations(db);

    expect(() => {
      db.prepare(
        "insert into merge_requests (mr_url, title, head_commit_hash, iteration_type, feedback_id_start, feedback_id_end, status, opened_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
      ).run(
        "https://example.com/mr/1",
        "[skills-feedback][minor][feedback:1-2] 2026-06-11 updates",
        "abc123",
        "minor",
        1,
        2,
        "waiting",
        "2026-06-11T00:00:00.000Z"
      );
    }).toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm vitest run tests/db/schema.test.ts
```

Expected: FAIL，原因是 `src/server/db/connection.ts` 和 `src/server/db/schema.ts` 尚不存在。

- [ ] **Step 3: 实现 SQLite 连接**

Create `src/server/db/connection.ts`:

```ts
import Database from "better-sqlite3";

export type Db = Database.Database;

export function createDatabase(filename = "data/skills-feedback.sqlite"): Db {
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");

  if (filename !== ":memory:") {
    db.pragma("journal_mode = WAL");
  }

  return db;
}
```

- [ ] **Step 4: 实现 schema migration**

Create `src/server/db/schema.ts`:

```ts
import type { Db } from "./connection.js";

export function runMigrations(db: Db): void {
  db.exec(`
    create table if not exists skill_invocations (
      id integer primary key autoincrement,
      skill_name text not null,
      working_directory text not null,
      tech_stack_json text not null,
      started_at text not null,
      finished_at text,
      status text not null check (status in ('success', 'failed', 'unknown'))
    );

    create table if not exists feedback_events (
      id integer primary key autoincrement,
      skill_name text not null,
      working_directory text not null,
      tech_stack_json text not null,
      ai_output text not null,
      user_correction_input text not null,
      classification_confidence real not null check (classification_confidence >= 0 and classification_confidence <= 1),
      needs_batch_review integer not null check (needs_batch_review in (0, 1)),
      created_at text not null
    );

    create table if not exists merge_requests (
      id integer primary key autoincrement,
      mr_url text not null unique,
      title text not null,
      head_commit_hash text not null,
      iteration_type text not null check (iteration_type in ('minor', 'major')),
      feedback_id_start integer not null,
      feedback_id_end integer not null,
      status text not null check (status in ('open', 'merged', 'closed')),
      opened_at text not null,
      merged_at text,
      purged_at text,
      check (feedback_id_start <= feedback_id_end)
    );

    create table if not exists purge_audit_logs (
      id integer primary key autoincrement,
      merge_request_id integer not null references merge_requests(id),
      feedback_id_start integer not null,
      feedback_id_end integer not null,
      deleted_count integer not null,
      purged_at text not null
    );
  `);
}
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
pnpm vitest run tests/db/schema.test.ts
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/server/db/connection.ts src/server/db/schema.ts tests/db/schema.test.ts
git commit -m "feat: 添加反馈服务数据库 schema"
```

## Task 3: 输入 schema、repository 和 CSV 工具

**Files:**

- Create: `src/server/domain/schemas.ts`
- Create: `src/server/domain/repositories.ts`
- Create: `src/server/domain/csv.ts`
- Test: `tests/domain/csv.test.ts`

- [ ] **Step 1: 写 CSV 失败测试**

Create `tests/domain/csv.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toCsv } from "../../src/server/domain/csv.js";

describe("toCsv", () => {
  it("escapes commas, quotes and newlines", () => {
    const csv = toCsv(
      ["id", "text"],
      [
        { id: 1, text: "hello, world" },
        { id: 2, text: "quote \"inside\"" },
        { id: 3, text: "line\nbreak" }
      ]
    );

    expect(csv).toBe(
      [
        "id,text",
        "1,\"hello, world\"",
        "2,\"quote \"\"inside\"\"\"",
        "3,\"line\nbreak\""
      ].join("\n")
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm vitest run tests/domain/csv.test.ts
```

Expected: FAIL，原因是 `src/server/domain/csv.ts` 尚不存在。

- [ ] **Step 3: 实现 CSV 工具**

Create `src/server/domain/csv.ts`:

```ts
type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  const raw = String(value);
  const mustQuote = raw.includes(",") || raw.includes("\"") || raw.includes("\n") || raw.includes("\r");
  const escaped = raw.replaceAll("\"", "\"\"");
  return mustQuote ? `"${escaped}"` : escaped;
}

export function toCsv<T extends Record<string, CsvValue>>(headers: Array<keyof T & string>, rows: T[]): string {
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(","));
  }

  return lines.join("\n");
}
```

- [ ] **Step 4: 实现输入 schema**

Create `src/server/domain/schemas.ts`:

```ts
import { z } from "zod";

const isoDateTime = z.string().datetime();

export const skillInvocationInputSchema = z.object({
  skill_name: z.string().min(1),
  working_directory: z.string().min(1),
  tech_stack: z.array(z.string().min(1)),
  started_at: isoDateTime,
  finished_at: isoDateTime.optional().nullable(),
  status: z.enum(["success", "failed", "unknown"])
});

export const feedbackInputSchema = z.object({
  skill_name: z.string().min(1),
  working_directory: z.string().min(1),
  tech_stack: z.array(z.string().min(1)),
  ai_output: z.string().min(1),
  user_correction_input: z.string().min(1),
  classification_confidence: z.number().min(0).max(1),
  needs_batch_review: z.boolean(),
  created_at: isoDateTime
});

export const mergeRequestInputSchema = z.object({
  mr_url: z.string().url(),
  title: z.string().min(1),
  head_commit_hash: z.string().min(1),
  iteration_type: z.enum(["minor", "major"]),
  feedback_id_start: z.number().int().positive(),
  feedback_id_end: z.number().int().positive(),
  status: z.enum(["open", "merged", "closed"]),
  opened_at: isoDateTime,
  merged_at: isoDateTime.optional().nullable()
}).refine((value) => value.feedback_id_start <= value.feedback_id_end, {
  message: "feedback_id_start must be less than or equal to feedback_id_end",
  path: ["feedback_id_end"]
});

export const mergeRequestStatusInputSchema = z.object({
  status: z.enum(["open", "merged", "closed"]),
  merged_at: isoDateTime.optional().nullable()
});

export type SkillInvocationInput = z.infer<typeof skillInvocationInputSchema>;
export type FeedbackInput = z.infer<typeof feedbackInputSchema>;
export type MergeRequestInput = z.infer<typeof mergeRequestInputSchema>;
export type MergeRequestStatusInput = z.infer<typeof mergeRequestStatusInputSchema>;
```

- [ ] **Step 5: 实现 repository**

Create `src/server/domain/repositories.ts`:

```ts
import type { Db } from "../db/connection.js";
import type {
  FeedbackInput,
  MergeRequestInput,
  MergeRequestStatusInput,
  SkillInvocationInput
} from "./schemas.js";

export type FeedbackRow = {
  id: number;
  skill_name: string;
  working_directory: string;
  tech_stack: string[];
  ai_output: string;
  user_correction_input: string;
  classification_confidence: number;
  needs_batch_review: boolean;
  created_at: string;
};

export type MergeRequestRow = {
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

type FeedbackDbRow = Omit<FeedbackRow, "tech_stack" | "needs_batch_review"> & {
  tech_stack_json: string;
  needs_batch_review: 0 | 1;
};

export function createSkillInvocation(db: Db, input: SkillInvocationInput): number {
  const result = db.prepare(`
    insert into skill_invocations (skill_name, working_directory, tech_stack_json, started_at, finished_at, status)
    values (?, ?, ?, ?, ?, ?)
  `).run(
    input.skill_name,
    input.working_directory,
    JSON.stringify(input.tech_stack),
    input.started_at,
    input.finished_at ?? null,
    input.status
  );

  return Number(result.lastInsertRowid);
}

export function createFeedbackEvent(db: Db, input: FeedbackInput): number {
  const result = db.prepare(`
    insert into feedback_events (
      skill_name,
      working_directory,
      tech_stack_json,
      ai_output,
      user_correction_input,
      classification_confidence,
      needs_batch_review,
      created_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.skill_name,
    input.working_directory,
    JSON.stringify(input.tech_stack),
    input.ai_output,
    input.user_correction_input,
    input.classification_confidence,
    input.needs_batch_review ? 1 : 0,
    input.created_at
  );

  return Number(result.lastInsertRowid);
}

export function listFeedbackByDateRange(db: Db, from: string, to: string): FeedbackRow[] {
  const rows = db.prepare(`
    select id, skill_name, working_directory, tech_stack_json, ai_output, user_correction_input,
      classification_confidence, needs_batch_review, created_at
    from feedback_events
    where created_at >= ? and created_at <= ?
    order by id asc
  `).all(from, to) as FeedbackDbRow[];

  return rows.map((row) => ({
    ...row,
    tech_stack: JSON.parse(row.tech_stack_json) as string[],
    needs_batch_review: row.needs_batch_review === 1
  }));
}

export function upsertMergeRequest(db: Db, input: MergeRequestInput): number {
  const existing = db.prepare("select id from merge_requests where mr_url = ?").get(input.mr_url) as
    | { id: number }
    | undefined;

  if (existing) {
    db.prepare(`
      update merge_requests
      set title = ?, head_commit_hash = ?, iteration_type = ?, feedback_id_start = ?, feedback_id_end = ?,
        status = ?, opened_at = ?, merged_at = ?
      where id = ?
    `).run(
      input.title,
      input.head_commit_hash,
      input.iteration_type,
      input.feedback_id_start,
      input.feedback_id_end,
      input.status,
      input.opened_at,
      input.merged_at ?? null,
      existing.id
    );
    return existing.id;
  }

  const result = db.prepare(`
    insert into merge_requests (
      mr_url, title, head_commit_hash, iteration_type, feedback_id_start, feedback_id_end, status, opened_at, merged_at
    )
    values (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.mr_url,
    input.title,
    input.head_commit_hash,
    input.iteration_type,
    input.feedback_id_start,
    input.feedback_id_end,
    input.status,
    input.opened_at,
    input.merged_at ?? null
  );

  return Number(result.lastInsertRowid);
}

export function updateMergeRequestStatus(db: Db, id: number, input: MergeRequestStatusInput): void {
  db.prepare("update merge_requests set status = ?, merged_at = ? where id = ?").run(
    input.status,
    input.merged_at ?? null,
    id
  );
}

export function getLatestMergeRequest(db: Db): MergeRequestRow | null {
  const row = db.prepare("select * from merge_requests order by opened_at desc, id desc limit 1").get() as
    | MergeRequestRow
    | undefined;

  return row ?? null;
}

export function getMergeRequestById(db: Db, id: number): MergeRequestRow | null {
  const row = db.prepare("select * from merge_requests where id = ?").get(id) as MergeRequestRow | undefined;
  return row ?? null;
}

export function purgeFeedbackForMergeRequest(db: Db, mergeRequest: MergeRequestRow, purgedAt: string): number {
  if (mergeRequest.status !== "merged") {
    throw new Error("Only merged merge requests can purge feedback");
  }

  if (mergeRequest.purged_at) {
    throw new Error("Merge request feedback was already purged");
  }

  const transaction = db.transaction(() => {
    const deleted = db.prepare("delete from feedback_events where id >= ? and id <= ?").run(
      mergeRequest.feedback_id_start,
      mergeRequest.feedback_id_end
    ).changes;

    db.prepare(`
      insert into purge_audit_logs (merge_request_id, feedback_id_start, feedback_id_end, deleted_count, purged_at)
      values (?, ?, ?, ?, ?)
    `).run(
      mergeRequest.id,
      mergeRequest.feedback_id_start,
      mergeRequest.feedback_id_end,
      deleted,
      purgedAt
    );

    db.prepare("update merge_requests set purged_at = ? where id = ?").run(purgedAt, mergeRequest.id);
    return deleted;
  });

  return transaction();
}
```

- [ ] **Step 6: 运行 CSV 测试**

Run:

```bash
pnpm vitest run tests/domain/csv.test.ts
```

Expected: PASS。

- [ ] **Step 7: 运行类型检查**

Run:

```bash
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add src/server/domain/schemas.ts src/server/domain/repositories.ts src/server/domain/csv.ts tests/domain/csv.test.ts
git commit -m "feat: 添加反馈数据校验和存储层"
```

## Task 4: MR 标题解析

**Files:**

- Create: `src/server/domain/mr-title.ts`
- Test: `tests/domain/mr-title.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/domain/mr-title.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMergeRequestTitle } from "../../src/server/domain/mr-title.js";

describe("parseMergeRequestTitle", () => {
  it("parses a minor feedback title", () => {
    expect(parseMergeRequestTitle("[skills-feedback][minor][feedback:1200-1488] 2026-06-17 skill updates")).toEqual({
      iteration_type: "minor",
      feedback_id_start: 1200,
      feedback_id_end: 1488
    });
  });

  it("parses a major feedback title", () => {
    expect(parseMergeRequestTitle("[skills-feedback][major][feedback:1200-1850] 2026-07-08 skill review")).toEqual({
      iteration_type: "major",
      feedback_id_start: 1200,
      feedback_id_end: 1850
    });
  });

  it("rejects invalid titles", () => {
    expect(() => parseMergeRequestTitle("skill updates")).toThrow("Invalid skills feedback MR title");
  });

  it("rejects reversed feedback ranges", () => {
    expect(() => parseMergeRequestTitle("[skills-feedback][minor][feedback:9-2] invalid")).toThrow(
      "feedback_id_start must be less than or equal to feedback_id_end"
    );
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm vitest run tests/domain/mr-title.test.ts
```

Expected: FAIL，原因是 `src/server/domain/mr-title.ts` 尚不存在。

- [ ] **Step 3: 实现 MR 标题解析**

Create `src/server/domain/mr-title.ts`:

```ts
export type ParsedMergeRequestTitle = {
  iteration_type: "minor" | "major";
  feedback_id_start: number;
  feedback_id_end: number;
};

const titlePattern = /^\[skills-feedback\]\[(minor|major)\]\[feedback:(\d+)-(\d+)\]\s+.+$/;

export function parseMergeRequestTitle(title: string): ParsedMergeRequestTitle {
  const match = title.match(titlePattern);

  if (!match) {
    throw new Error("Invalid skills feedback MR title");
  }

  const feedback_id_start = Number(match[2]);
  const feedback_id_end = Number(match[3]);

  if (feedback_id_start > feedback_id_end) {
    throw new Error("feedback_id_start must be less than or equal to feedback_id_end");
  }

  return {
    iteration_type: match[1] as "minor" | "major",
    feedback_id_start,
    feedback_id_end
  };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm vitest run tests/domain/mr-title.test.ts
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/server/domain/mr-title.ts tests/domain/mr-title.test.ts
git commit -m "feat: 添加反馈 MR 标题解析"
```

## Task 5: Fastify app 和核心 API

**Files:**

- Create: `src/server/app.ts`
- Create: `src/server/index.ts`
- Test: `tests/api/feedback-api.test.ts`

- [ ] **Step 1: 写 API 失败测试**

Create `tests/api/feedback-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app.js";
import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";

function testApp() {
  const db = createDatabase(":memory:");
  runMigrations(db);
  return buildApp({ db });
}

describe("feedback API", () => {
  it("records a skill invocation", async () => {
    const app = testApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/skill-invocations",
      payload: {
        skill_name: "superpowers:brainstorming",
        working_directory: "/repo/project",
        tech_stack: ["typescript"],
        started_at: "2026-06-11T00:00:00.000Z",
        finished_at: "2026-06-11T00:01:00.000Z",
        status: "success"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: 1 });
  });

  it("records a correction feedback event", async () => {
    const app = testApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: {
        skill_name: "superpowers:brainstorming",
        working_directory: "/repo/project",
        tech_stack: ["typescript"],
        ai_output: "错误地把补充当成纠错",
        user_correction_input: "不对，这是补充不是纠错",
        classification_confidence: 0.91,
        needs_batch_review: false,
        created_at: "2026-06-11T00:02:00.000Z"
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ id: 1 });
  });

  it("rejects invalid feedback confidence", async () => {
    const app = testApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: {
        skill_name: "superpowers:brainstorming",
        working_directory: "/repo/project",
        tech_stack: ["typescript"],
        ai_output: "output",
        user_correction_input: "correction",
        classification_confidence: 1.5,
        needs_batch_review: false,
        created_at: "2026-06-11T00:02:00.000Z"
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("exports feedback as CSV for a date range", async () => {
    const app = testApp();

    await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: {
        skill_name: "superpowers:brainstorming",
        working_directory: "/repo/project",
        tech_stack: ["typescript", "fastify"],
        ai_output: "output with, comma",
        user_correction_input: "不对",
        classification_confidence: 0.88,
        needs_batch_review: false,
        created_at: "2026-06-11T00:02:00.000Z"
      }
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/feedback.csv?from=2026-06-11T00:00:00.000Z&to=2026-06-11T23:59:59.999Z"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.body).toContain("id,skill_name,working_directory,tech_stack,ai_output");
    expect(response.body).toContain("\"output with, comma\"");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm vitest run tests/api/feedback-api.test.ts
```

Expected: FAIL，原因是 `src/server/app.ts` 尚不存在。

- [ ] **Step 3: 实现 Fastify app**

Create `src/server/app.ts`:

```ts
import Fastify from "fastify";
import type { Db } from "./db/connection.js";
import { toCsv } from "./domain/csv.js";
import {
  createFeedbackEvent,
  createSkillInvocation,
  listFeedbackByDateRange
} from "./domain/repositories.js";
import { feedbackInputSchema, skillInvocationInputSchema } from "./domain/schemas.js";

export type BuildAppOptions = {
  db: Db;
};

export function buildApp(options: BuildAppOptions) {
  const app = Fastify({ logger: false });

  app.post("/api/skill-invocations", async (request, reply) => {
    const parsed = skillInvocationInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid skill invocation payload", details: parsed.error.flatten() });
    }

    const id = createSkillInvocation(options.db, parsed.data);
    return reply.code(201).send({ id });
  });

  app.post("/api/feedback", async (request, reply) => {
    const parsed = feedbackInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid feedback payload", details: parsed.error.flatten() });
    }

    const id = createFeedbackEvent(options.db, parsed.data);
    return reply.code(201).send({ id });
  });

  app.get("/api/feedback.csv", async (request, reply) => {
    const query = request.query as { from?: string; to?: string };

    if (!query.from || !query.to) {
      return reply.code(400).send({ error: "from and to query parameters are required" });
    }

    const rows = listFeedbackByDateRange(options.db, query.from, query.to).map((row) => ({
      ...row,
      tech_stack: row.tech_stack.join(";"),
      needs_batch_review: row.needs_batch_review ? "true" : "false"
    }));

    const csv = toCsv(
      [
        "id",
        "skill_name",
        "working_directory",
        "tech_stack",
        "ai_output",
        "user_correction_input",
        "classification_confidence",
        "needs_batch_review",
        "created_at"
      ],
      rows
    );

    return reply.header("content-type", "text/csv; charset=utf-8").send(csv);
  });

  return app;
}
```

- [ ] **Step 4: 实现服务启动入口**

Create `src/server/index.ts`:

```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createDatabase } from "./db/connection.js";
import { runMigrations } from "./db/schema.js";
import { buildApp } from "./app.js";

const databasePath = process.env.SKILLS_FEEDBACK_DB ?? "data/skills-feedback.sqlite";
mkdirSync(dirname(databasePath), { recursive: true });

const db = createDatabase(databasePath);
runMigrations(db);

const app = buildApp({ db });
const port = Number(process.env.PORT ?? 4321);

await app.listen({ host: "0.0.0.0", port });
console.log(`skills feedback server listening on http://localhost:${port}`);
```

- [ ] **Step 5: 运行 API 测试**

Run:

```bash
pnpm vitest run tests/api/feedback-api.test.ts
```

Expected: PASS。

- [ ] **Step 6: 运行类型检查**

Run:

```bash
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add src/server/app.ts src/server/index.ts tests/api/feedback-api.test.ts
git commit -m "feat: 添加反馈采集 API"
```

## Task 6: MR 元信息 API 和合并后清理 API

**Files:**

- Modify: `src/server/app.ts`
- Test: `tests/api/merge-request-api.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/api/merge-request-api.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app.js";
import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";

function testApp() {
  const db = createDatabase(":memory:");
  runMigrations(db);
  return buildApp({ db });
}

async function seedFeedback(app: ReturnType<typeof buildApp>) {
  for (const created_at of ["2026-06-11T00:00:00.000Z", "2026-06-11T00:01:00.000Z"]) {
    await app.inject({
      method: "POST",
      url: "/api/feedback",
      payload: {
        skill_name: "superpowers:brainstorming",
        working_directory: "/repo/project",
        tech_stack: ["typescript"],
        ai_output: "wrong",
        user_correction_input: "不对",
        classification_confidence: 0.9,
        needs_batch_review: false,
        created_at
      }
    });
  }
}

describe("merge request API", () => {
  it("records and returns latest merge request", async () => {
    const app = testApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/merge-requests",
      payload: {
        mr_url: "https://example.com/mr/1",
        title: "[skills-feedback][minor][feedback:1-2] 2026-06-11 skill updates",
        head_commit_hash: "abc123",
        iteration_type: "minor",
        feedback_id_start: 1,
        feedback_id_end: 2,
        status: "open",
        opened_at: "2026-06-11T00:10:00.000Z"
      }
    });

    expect(createResponse.statusCode).toBe(201);

    const latestResponse = await app.inject({ method: "GET", url: "/api/latest-merge-request" });
    expect(latestResponse.statusCode).toBe(200);
    expect(latestResponse.json()).toMatchObject({
      mr_url: "https://example.com/mr/1",
      head_commit_hash: "abc123",
      feedback_id_start: 1,
      feedback_id_end: 2,
      status: "open"
    });
  });

  it("rejects merge request titles without feedback range", async () => {
    const app = testApp();

    const response = await app.inject({
      method: "POST",
      url: "/api/merge-requests",
      payload: {
        mr_url: "https://example.com/mr/1",
        title: "plain title",
        head_commit_hash: "abc123",
        iteration_type: "minor",
        feedback_id_start: 1,
        feedback_id_end: 2,
        status: "open",
        opened_at: "2026-06-11T00:10:00.000Z"
      }
    });

    expect(response.statusCode).toBe(400);
  });

  it("does not purge feedback for an open merge request", async () => {
    const app = testApp();
    await seedFeedback(app);

    await app.inject({
      method: "POST",
      url: "/api/merge-requests",
      payload: {
        mr_url: "https://example.com/mr/1",
        title: "[skills-feedback][minor][feedback:1-2] 2026-06-11 skill updates",
        head_commit_hash: "abc123",
        iteration_type: "minor",
        feedback_id_start: 1,
        feedback_id_end: 2,
        status: "open",
        opened_at: "2026-06-11T00:10:00.000Z"
      }
    });

    const response = await app.inject({ method: "POST", url: "/api/admin/merge-requests/1/purge" });
    expect(response.statusCode).toBe(409);
  });

  it("purges feedback only after merge request is merged", async () => {
    const app = testApp();
    await seedFeedback(app);

    await app.inject({
      method: "POST",
      url: "/api/merge-requests",
      payload: {
        mr_url: "https://example.com/mr/1",
        title: "[skills-feedback][major][feedback:1-2] 2026-06-11 skill review",
        head_commit_hash: "abc123",
        iteration_type: "major",
        feedback_id_start: 1,
        feedback_id_end: 2,
        status: "open",
        opened_at: "2026-06-11T00:10:00.000Z"
      }
    });

    await app.inject({
      method: "PATCH",
      url: "/api/merge-requests/1/status",
      payload: {
        status: "merged",
        merged_at: "2026-06-11T00:20:00.000Z"
      }
    });

    const response = await app.inject({ method: "POST", url: "/api/admin/merge-requests/1/purge" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ deleted_count: 2 });

    const csvResponse = await app.inject({
      method: "GET",
      url: "/api/feedback.csv?from=2026-06-11T00:00:00.000Z&to=2026-06-11T23:59:59.999Z"
    });
    expect(csvResponse.body).toBe("id,skill_name,working_directory,tech_stack,ai_output,user_correction_input,classification_confidence,needs_batch_review,created_at");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm vitest run tests/api/merge-request-api.test.ts
```

Expected: FAIL，原因是 MR API 尚未挂载。

- [ ] **Step 3: 扩展 app.ts**

Modify `src/server/app.ts` by adding these imports:

```ts
import { parseMergeRequestTitle } from "./domain/mr-title.js";
import {
  getLatestMergeRequest,
  getMergeRequestById,
  purgeFeedbackForMergeRequest,
  updateMergeRequestStatus,
  upsertMergeRequest
} from "./domain/repositories.js";
import { mergeRequestInputSchema, mergeRequestStatusInputSchema } from "./domain/schemas.js";
```

Then add these routes before `return app;`:

```ts
  app.get("/api/latest-merge-request", async (_request, reply) => {
    const latest = getLatestMergeRequest(options.db);

    if (!latest) {
      return reply.code(404).send({ error: "No merge request recorded" });
    }

    return reply.send(latest);
  });

  app.post("/api/merge-requests", async (request, reply) => {
    const parsed = mergeRequestInputSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid merge request payload", details: parsed.error.flatten() });
    }

    let titleRange;
    try {
      titleRange = parseMergeRequestTitle(parsed.data.title);
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid merge request title" });
    }

    if (
      titleRange.iteration_type !== parsed.data.iteration_type ||
      titleRange.feedback_id_start !== parsed.data.feedback_id_start ||
      titleRange.feedback_id_end !== parsed.data.feedback_id_end
    ) {
      return reply.code(400).send({ error: "Merge request title feedback range does not match payload" });
    }

    const id = upsertMergeRequest(options.db, parsed.data);
    return reply.code(201).send({ id });
  });

  app.patch("/api/merge-requests/:id/status", async (request, reply) => {
    const params = request.params as { id: string };
    const id = Number(params.id);
    const parsed = mergeRequestStatusInputSchema.safeParse(request.body);

    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: "Invalid merge request id" });
    }

    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid merge request status payload", details: parsed.error.flatten() });
    }

    updateMergeRequestStatus(options.db, id, parsed.data);
    return reply.send({ id });
  });

  app.post("/api/admin/merge-requests/:id/purge", async (request, reply) => {
    const params = request.params as { id: string };
    const id = Number(params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return reply.code(400).send({ error: "Invalid merge request id" });
    }

    const mergeRequest = getMergeRequestById(options.db, id);
    if (!mergeRequest) {
      return reply.code(404).send({ error: "Merge request not found" });
    }

    try {
      const deletedCount = purgeFeedbackForMergeRequest(options.db, mergeRequest, new Date().toISOString());
      return reply.send({ deleted_count: deletedCount });
    } catch (error) {
      return reply.code(409).send({ error: error instanceof Error ? error.message : "Purge failed" });
    }
  });
```

- [ ] **Step 4: 运行 MR API 测试**

Run:

```bash
pnpm vitest run tests/api/merge-request-api.test.ts
```

Expected: PASS。

- [ ] **Step 5: 运行全量 API 测试**

Run:

```bash
pnpm vitest run tests/api
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add src/server/app.ts tests/api/merge-request-api.test.ts
git commit -m "feat: 添加 MR 元信息和清理 API"
```

## Task 7: 监控统计和网页

**Files:**

- Create: `src/server/domain/stats.ts`
- Create: `src/server/web/layout.ts`
- Create: `src/server/web/dashboard.ts`
- Create: `src/server/web/admin.ts`
- Modify: `src/server/app.ts`
- Test: `tests/domain/stats.test.ts`
- Test: `tests/web/pages.test.ts`

- [ ] **Step 1: 写统计失败测试**

Create `tests/domain/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";
import { getSkillStats } from "../../src/server/domain/stats.js";

describe("getSkillStats", () => {
  it("calculates invocation count, correction count and correction rate", () => {
    const db = createDatabase(":memory:");
    runMigrations(db);

    db.prepare(
      "insert into skill_invocations (skill_name, working_directory, tech_stack_json, started_at, finished_at, status) values (?, ?, ?, ?, ?, ?)"
    ).run("skill-a", "/repo", "[]", "2026-06-11T00:00:00.000Z", null, "success");
    db.prepare(
      "insert into skill_invocations (skill_name, working_directory, tech_stack_json, started_at, finished_at, status) values (?, ?, ?, ?, ?, ?)"
    ).run("skill-a", "/repo", "[]", "2026-06-11T00:01:00.000Z", null, "success");
    db.prepare(
      "insert into feedback_events (skill_name, working_directory, tech_stack_json, ai_output, user_correction_input, classification_confidence, needs_batch_review, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run("skill-a", "/repo", "[]", "wrong", "不对", 0.9, 0, "2026-06-11T00:02:00.000Z");

    expect(getSkillStats(db)).toEqual([
      {
        skill_name: "skill-a",
        invocation_count: 2,
        correction_count: 1,
        correction_rate: 0.5
      }
    ]);
  });
});
```

- [ ] **Step 2: 写网页失败测试**

Create `tests/web/pages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app.js";
import { createDatabase } from "../../src/server/db/connection.js";
import { runMigrations } from "../../src/server/db/schema.js";

function testApp() {
  const db = createDatabase(":memory:");
  runMigrations(db);
  return buildApp({ db });
}

describe("web pages", () => {
  it("renders the dashboard", async () => {
    const app = testApp();
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.body).toContain("Skill 调用监控");
  });

  it("renders the system admin page", async () => {
    const app = testApp();
    const response = await app.inject({ method: "GET", url: "/admin" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toContain("系统管理");
    expect(response.body).toContain("合并后清理");
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run:

```bash
pnpm vitest run tests/domain/stats.test.ts tests/web/pages.test.ts
```

Expected: FAIL，原因是统计和网页文件尚不存在。

- [ ] **Step 4: 实现统计函数**

Create `src/server/domain/stats.ts`:

```ts
import type { Db } from "../db/connection.js";

export type SkillStat = {
  skill_name: string;
  invocation_count: number;
  correction_count: number;
  correction_rate: number;
};

export function getSkillStats(db: Db): SkillStat[] {
  const rows = db.prepare(`
    select
      skill_name,
      sum(invocation_count) as invocation_count,
      sum(correction_count) as correction_count
    from (
      select skill_name, count(*) as invocation_count, 0 as correction_count
      from skill_invocations
      group by skill_name
      union all
      select skill_name, 0 as invocation_count, count(*) as correction_count
      from feedback_events
      group by skill_name
    )
    group by skill_name
    order by correction_count desc, invocation_count desc, skill_name asc
  `).all() as Array<{ skill_name: string; invocation_count: number; correction_count: number }>;

  return rows.map((row) => ({
    ...row,
    correction_rate: row.invocation_count === 0 ? 0 : row.correction_count / row.invocation_count
  }));
}

export function getTotals(db: Db) {
  const invocationCount = db.prepare("select count(*) as count from skill_invocations").get() as { count: number };
  const feedbackCount = db.prepare("select count(*) as count from feedback_events").get() as { count: number };
  return {
    invocation_count: invocationCount.count,
    feedback_count: feedbackCount.count
  };
}
```

- [ ] **Step 5: 实现 HTML 布局**

Create `src/server/web/layout.ts`:

```ts
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

export function renderLayout(title: string, body: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2937; background: #f8fafc; }
    header { background: #111827; color: white; padding: 16px 24px; }
    nav a { color: #bfdbfe; margin-right: 16px; text-decoration: none; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e5e7eb; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    th { background: #f3f4f6; }
    .metric { display: inline-block; margin-right: 16px; padding: 12px 16px; background: white; border: 1px solid #e5e7eb; }
    .muted { color: #6b7280; }
    button { padding: 8px 12px; border: 1px solid #1f2937; background: #1f2937; color: white; cursor: pointer; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <nav><a href="/">监控</a><a href="/admin">系统管理</a></nav>
  </header>
  <main>${body}</main>
</body>
</html>`;
}
```

- [ ] **Step 6: 实现 dashboard 页面**

Create `src/server/web/dashboard.ts`:

```ts
import type { Db } from "../db/connection.js";
import { getSkillStats, getTotals } from "../domain/stats.js";
import { escapeHtml, renderLayout } from "./layout.js";

export function renderDashboard(db: Db): string {
  const totals = getTotals(db);
  const stats = getSkillStats(db);

  const rows = stats
    .map((stat) => `<tr>
      <td>${escapeHtml(stat.skill_name)}</td>
      <td>${stat.invocation_count}</td>
      <td>${stat.correction_count}</td>
      <td>${(stat.correction_rate * 100).toFixed(1)}%</td>
    </tr>`)
    .join("");

  return renderLayout(
    "Skill 调用监控",
    `<section>
      <div class="metric"><strong>${totals.invocation_count}</strong><div class="muted">总调用次数</div></div>
      <div class="metric"><strong>${totals.feedback_count}</strong><div class="muted">纠错反馈数</div></div>
    </section>
    <section>
      <h2>按 Skill 聚合</h2>
      <table>
        <thead><tr><th>Skill</th><th>调用次数</th><th>纠错次数</th><th>纠错率</th></tr></thead>
        <tbody>${rows || "<tr><td colspan=\"4\" class=\"muted\">暂无数据</td></tr>"}</tbody>
      </table>
    </section>`
  );
}
```

- [ ] **Step 7: 实现 admin 页面**

Create `src/server/web/admin.ts`:

```ts
import type { Db } from "../db/connection.js";
import { getLatestMergeRequest } from "../domain/repositories.js";
import { escapeHtml, renderLayout } from "./layout.js";

export function renderAdmin(db: Db): string {
  const latest = getLatestMergeRequest(db);

  const content = latest
    ? `<table>
        <tbody>
          <tr><th>MR</th><td><a href="${escapeHtml(latest.mr_url)}">${escapeHtml(latest.title)}</a></td></tr>
          <tr><th>状态</th><td>${escapeHtml(latest.status)}</td></tr>
          <tr><th>Commit</th><td>${escapeHtml(latest.head_commit_hash)}</td></tr>
          <tr><th>反馈范围</th><td>${latest.feedback_id_start}-${latest.feedback_id_end}</td></tr>
          <tr><th>已清理</th><td>${latest.purged_at ? escapeHtml(latest.purged_at) : "否"}</td></tr>
        </tbody>
      </table>
      <form method="post" action="/api/admin/merge-requests/${latest.id}/purge">
        <p class="muted">只有状态为 merged 且未清理的 MR 可以执行物理删除。</p>
        <button type="submit">合并后清理</button>
      </form>`
    : `<p class="muted">暂无 MR 元信息。</p>`;

  return renderLayout("系统管理", `<h2>合并后清理</h2>${content}`);
}
```

- [ ] **Step 8: 挂载网页路由**

Modify `src/server/app.ts` by adding imports:

```ts
import { renderAdmin } from "./web/admin.js";
import { renderDashboard } from "./web/dashboard.js";
```

Then add routes before `return app;`:

```ts
  app.get("/", async (_request, reply) => {
    return reply.header("content-type", "text/html; charset=utf-8").send(renderDashboard(options.db));
  });

  app.get("/admin", async (_request, reply) => {
    return reply.header("content-type", "text/html; charset=utf-8").send(renderAdmin(options.db));
  });
```

- [ ] **Step 9: 运行网页和统计测试**

Run:

```bash
pnpm vitest run tests/domain/stats.test.ts tests/web/pages.test.ts
```

Expected: PASS。

- [ ] **Step 10: Commit**

```bash
git add src/server/domain/stats.ts src/server/web/layout.ts src/server/web/dashboard.ts src/server/web/admin.ts src/server/app.ts tests/domain/stats.test.ts tests/web/pages.test.ts
git commit -m "feat: 添加 skill 监控和系统管理页面"
```

## Task 8: Feedback Skill 规则文件

**Files:**

- Create: `skills/feedback-rules/SKILL.md`
- Create: `skills/feedback-rules/EXAMPLES.md`
- Create: `scripts/validate-feedback-skill.mjs`
- Test: `tests/skills/feedback-skill.test.ts`

- [ ] **Step 1: 写失败测试**

Create `tests/skills/feedback-skill.test.ts`:

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm vitest run tests/skills/feedback-skill.test.ts
```

Expected: FAIL，原因是 `skills/feedback-rules/SKILL.md` 尚不存在。

- [ ] **Step 3: 创建 feedback skill 主文档**

Create `skills/feedback-rules/SKILL.md`:

```markdown
---
name: feedback-rules
description: 为 Agent 注入 skill 纠错反馈上报规则、反馈豁免规则和升级检查规则。该 skill 是系统协议 skill，不参与反馈闭环。
---

# Feedback Rules

## 自身豁免

- 本 skill 不计入反馈统计。
- 本 skill 不接收自动反馈。
- 不得把本 skill 作为 skill_name 上报。
- 用户纠错本 skill 时，不触发反馈上报。

## 输入分类时机

每次 AI 输出后，用户的下一条输入都必须进入分类流程。这里的下一条输入指任意一次 AI 输出后的下一条用户输入。

## 输入类型

将用户输入分类为：

- `correction`：用户认为上一轮 AI 输出存在错误、遗漏、偏离或不满足要求，并且该反馈需要改变上一轮输出的判断、内容或后续行为。
- `guidance`：用户调整接下来的方向、偏好或执行方式，但没有否定上一轮输出。
- `supplement`：用户补充新上下文、新约束或新资料，但没有否定上一轮输出。
- `mixed`：同一输入同时包含纠错和补充或引导。
- `unknown`：无法可靠判断。

## 纠错信号

纠错信号包括：

- 明确否定：不对、错了、不是这个、你理解错了。
- 指出欠缺：没考虑、少了、不完整、没有覆盖。
- 替换性纠正：应该是、我说的是。
- 结果性纠错：跑不通、报错、不符合规则。
- 边界纠错：这个只适用于某范围，不适用于另一范围。

如果一条输入同时包含补充和纠错，只要它明确指向上一轮输出的问题，就按纠错处理。

## 分类输出

分类结果使用以下结构：

```json
{
  "input_type": "correction | guidance | supplement | mixed | unknown",
  "confidence": 0.0,
  "matched_signals": ["explicit_negation", "missing_requirement"],
  "target_skill_name": "skill-name",
  "reason": "用户指出上一轮输出缺少监控逻辑"
}
```

## 置信度和上报

- `confidence >= 0.8`：直接上报。
- `0.6 <= confidence < 0.8`：上报，并标记为 `needs_batch_review`。
- `confidence < 0.6`：不上报。

只有同时满足以下条件时才上报：

- 输入是 `correction`，或 `mixed` 且包含纠错。
- 纠错指向一个真实业务 skill。
- 该 skill 是用户主动触发，或 AI 根据输入匹配调用过的 skill。
- 该 skill 不是本 feedback-rules skill。

只上报用户纠错指向的真实业务 skill。没有调用 skill 的普通对话不上报。

## 上报字段

反馈事件至少包含：

- `skill_name`
- `working_directory`
- `tech_stack`
- `ai_output`
- `user_correction_input`
- `classification_confidence`
- `needs_batch_review`
- `created_at`

`tech_stack` 优先从 repo 文件中检测；无法检测时再由 AI 根据上下文推断。

## 升级检查规则

本地自动化可以定期检查 feedback server 的最新 MR 元信息接口：

```text
GET /api/latest-merge-request
```

如果返回的 `head_commit_hash` 与本地已记录 hash 不同，则说明 skill 仓库存在新的升级候选。自动化应提示用户审查 MR 或同步仓库，不得自动合并。
```

- [ ] **Step 4: 创建示例文件**

Create `skills/feedback-rules/EXAMPLES.md`:

```markdown
# Feedback Rules Examples

## 示例：明确纠错

### 错误场景

AI 使用某个业务 skill 后输出了错误判断，用户下一条输入明确否定。

### 错误输出

AI 将用户补充的系统设计内容解释为已经完成的实现。

### 正确做法

将用户输入分类为 `correction`，记录被纠错的业务 skill，并按置信度规则上报。

### 适用边界

仅适用于纠错指向真实业务 skill 的情况。如果没有调用真实业务 skill，不上报。

### Demo

```text
AI: 这个系统已经可以自动合并 MR。
User: 不对，MR 必须 owner 审批后才能合并。
Classification: correction, confidence 0.95
```
```

- [ ] **Step 5: 创建校验脚本**

Create `scripts/validate-feedback-skill.mjs`:

```js
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
```

- [ ] **Step 6: 运行 skill 测试和脚本**

Run:

```bash
pnpm vitest run tests/skills/feedback-skill.test.ts
pnpm run validate:feedback-skill
```

Expected: 两个命令都 PASS，脚本输出 `feedback-rules skill validation passed`。

- [ ] **Step 7: Commit**

```bash
git add skills/feedback-rules/SKILL.md skills/feedback-rules/EXAMPLES.md scripts/validate-feedback-skill.mjs tests/skills/feedback-skill.test.ts
git commit -m "feat: 添加反馈规则 skill"
```

## Task 9: 全量验证和本地运行检查

**Files:**

- Modify: no files expected.

- [ ] **Step 1: 运行测试**

Run:

```bash
pnpm run test
```

Expected: PASS。

- [ ] **Step 2: 运行类型检查**

Run:

```bash
pnpm run typecheck
```

Expected: PASS。

- [ ] **Step 3: 构建**

Run:

```bash
pnpm run build
```

Expected: PASS，并生成 `dist/`。

- [ ] **Step 4: 启动本地服务**

Run:

```bash
pnpm run dev
```

Expected: 输出 `skills feedback server listening on http://localhost:4321`。

- [ ] **Step 5: 手动检查页面**

Open:

```text
http://localhost:4321/
http://localhost:4321/admin
```

Expected:

- `/` 展示 `Skill 调用监控`。
- `/admin` 展示 `系统管理` 和 `合并后清理`。
- 页面无明显文本重叠。
- 空数据状态显示正常。

- [ ] **Step 6: 确认没有意外变更**

Run:

```bash
git status --short
```

Expected: 输出为空。若存在变更，先阅读 diff，确认它属于前面任务的遗漏修正，再为实际文件写一个明确提交命令。

## 自审结果

- Spec 覆盖：本计划覆盖 feedback skill、server API、监控页面、CSV 导出、最新 MR 元信息、MR 元信息回写和系统管理清理入口。
- 延后范围：Agent 云任务的小迭代/大迭代执行、AI 归纳、分支/MR 创建、用户本地自动化检查将在后续独立计划中实现。
- 占位符扫描：本文档不使用待补充占位符；每个代码步骤给出明确文件、代码或命令。
- 类型一致性：API 字段与设计文档保持一致；MR 标题解析字段使用 `iteration_type`、`feedback_id_start`、`feedback_id_end`。
- 风险：Task 1 会安装新依赖，执行时必须先向用户请求审批。
