# skills-to-the-moon

Self-hosted feedback loops for Agent skills.

`skills-to-the-moon` 把 Agent 被用户纠错的瞬间记录下来，沉淀成可追踪反馈，再通过周期性归纳、PR 审批和本地同步，把高价值经验升级回 skill 仓库。

![系统架构](docs/assets/architecture.png)

## 核心能力

- **可自迭代**：把纠错反馈提取成 `EXAMPLES.md` 示例，并在满足条件时提升到 `SKILL.md` 规则。
- **可监控**：记录 skill 调用、纠错次数、纠错率和最近 MR 状态。
- **可追踪**：保留 skill 名称、工作目录、技术栈、AI 输出、用户纠错输入和反馈 ID 范围。
- **可审批**：所有 skill 升级都走 PR，owner 审查后合并。
- **可同步**：本地通过 `npx` 检查最新已合并 MR，全量同步 skill，并写入 last-seen hash。

## 给使用者

你需要部署一个 feedback server，安装一个 scoped feedback rules skill，然后配置两类自动化 Agent：

- **云端迭代 Agent**：周期性拉取反馈、归纳示例、创建 PR，并把 PR 元信息回写 server。
- **本地升级检查 Agent**：定期检查已合并 PR，如果有新 hash，就全量同步本地 skills。

### 1. 部署 feedback server

安装并启动：

```bash
pnpm install
pnpm run build

SKILLS_FEEDBACK_DB=./data/skills-feedback.sqlite \
SKILLS_FEEDBACK_ADMIN_TOKEN=change-me \
HOST=127.0.0.1 \
PORT=4321 \
pnpm start
```

开发模式：

```bash
SKILLS_FEEDBACK_DB=./data/skills-feedback.sqlite \
SKILLS_FEEDBACK_ADMIN_TOKEN=change-me \
HOST=127.0.0.1 \
PORT=4321 \
pnpm run dev
```

页面：

```text
http://127.0.0.1:4321/
http://127.0.0.1:4321/admin
```

server 可以部署在本机，也可以部署在团队 dev server。安装 feedback rules 时要把 Agent 实际可请求的 server address 打包进去。

### 2. 安装 feedback rules skill

线上安装：

```bash
npx skills-to-the-moon install-feedback-rules \
  --scope <scope> \
  --server-address <server-address> \
  --skills <skill-a,skill-b>
```

示例：

```bash
npx skills-to-the-moon install-feedback-rules \
  --scope github-smoke \
  --server-address http://127.0.0.1:4321 \
  --skills github-smoke-canary
```

本地仓库开发时：

```bash
node bin/skills-to-the-moon.mjs install-feedback-rules \
  --scope github-smoke \
  --server-address http://127.0.0.1:4321 \
  --skills github-smoke-canary
```

该命令会：

- 生成并安装 `feedback-rules-${scope}`。
- 把 scope、server address、reportable skills 写入全局 `AGENTS.md` 的 Feedback 上报预授权块。
- 明确沙箱不可达时不先探测 server，直接对符合预授权的请求申请非沙箱执行。

### 3. 安装或更新常规 skills

常规 skill 是仓库里的 `skills/*`。当 owner 合并升级 PR 后，本地执行：

```bash
npx skills-to-the-moon sync-upgrades \
  --scope <scope> \
  --server-address <server-address> \
  --repo <owner>/<repo> \
  --ref main
```

示例：

```bash
npx skills-to-the-moon sync-upgrades \
  --scope github-smoke \
  --server-address http://127.0.0.1:4321 \
  --repo Ryan2128/skills-to-the-moon \
  --ref main
```

本地开发 mock：

```bash
node bin/skills-to-the-moon.mjs sync-upgrades \
  --scope github-smoke \
  --server-address http://127.0.0.1:4321 \
  --source-dir /path/to/skills-to-the-moon
```

同步规则：

- 只读取 `GET /api/latest-merge-request`。
- 未合并 MR 不同步。
- `head_commit_hash` 与本地 last-seen 相同则跳过。
- 已合并且未处理时，全量安装 repo 内 `skills/*`。
- 同步成功后写入 `~/.agents/skills/.feedback-upgrades/<scope>.last-seen`。

### 4. 配置云端迭代 Agent

使用模板：

[迭代创建自动化 Agent Prompt](docs/automation-templates/iteration-agent-prompt.md)

这个 Agent 负责：

- 定期请求 `GET /api/feedback.csv`。
- 判断小迭代或大迭代。
- 更新 `EXAMPLES.md` 和必要的 `SKILL.md`。
- 创建 PR，等待 owner 审批。
- 调 `POST /api/merge-requests` 回写 MR 元信息。

### 5. 配置本地升级检查 Agent

使用模板：

[本地自动化检查升级 Agent Prompt](docs/automation-templates/local-upgrade-check-agent-prompt.md)

这个 Agent 负责：

- 定期请求 `GET /api/latest-merge-request`。
- 比对 `~/.agents/skills/.feedback-upgrades/<scope>.last-seen`。
- 对已合并且未处理的 MR 执行 `sync-upgrades`。
- 同步成功后写入 last-seen hash。

### 6. 合并后清理反馈

清理入口在 `/admin`。

规则：

- 只有合并后的 MR 才能清理。
- 小迭代 MR 合并后不物理删除反馈。
- 大迭代 MR 合并后，管理员可以按 MR 标题中的反馈 ID 范围物理删除反馈。

## 给开发者

### 架构

```text
Agent Runtime
  -> feedback-rules-${scope}
  -> POST /api/skill-invocations
  -> POST /api/feedback

Feedback Server
  -> Fastify API
  -> SQLite
  -> dashboard / admin
  -> feedback CSV
  -> latest MR metadata

Agent 云任务
  -> 拉取 CSV
  -> 归纳 EXAMPLES.md / SKILL.md
  -> 创建 PR
  -> 回写 MR 元信息

本地自动化
  -> GET /api/latest-merge-request
  -> npx skills-to-the-moon sync-upgrades
  -> 更新 ~/.agents/skills
  -> 写入 .feedback-upgrades/<scope>.last-seen
```

### API

```text
POST /api/skill-invocations
POST /api/feedback
GET  /api/feedback.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
GET  /api/latest-merge-request
POST /api/merge-requests
PATCH /api/merge-requests/:id/status
POST /api/admin/merge-requests/:id/purge
```

### 开发验证

```bash
pnpm test
pnpm run typecheck
pnpm run build
pnpm run validate:feedback-skill
```

### npm 发布流程

发布前检查：

```bash
pnpm test
pnpm run typecheck
pnpm run build
pnpm run validate:feedback-skill
npm pack --dry-run
```

确认 `npm pack --dry-run` 里包含 `bin/`、`scripts/`、`templates/`、`skills/`、`dist/`、`README.md` 和 `LICENSE`。

首次发布公开包：

```bash
npm login
npm publish
```

如果账号开启 2FA，按 npm 提示输入 OTP。CI 发布建议使用 npm trusted publishing 或 provenance。

版本更新：

```bash
npm version patch
npm publish
git push --follow-tags
```

参考：

- [npm: 创建并发布公开包](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)
- [npm publish](https://docs.npmjs.com/cli/v10/commands/npm-publish/)
- [package.json bin 字段](https://docs.npmjs.com/cli/v10/configuring-npm/package-json/#bin)

### 项目状态

当前是 MVP 阶段，已经覆盖 feedback server、scoped feedback rules、调用/纠错上报、监控页面、MR 元信息、合并后清理入口和本地升级同步命令。

仍在演进中的部分：

- Agent 云任务自动归纳反馈并创建 PR。
- 更完整的多 scope 冲突检查和诊断输出。
- 更细的发布工作流和 CI provenance。

### 欢迎贡献

欢迎 PR、Issue 和真实使用反馈。尤其欢迎：

- 新的 skill 纠错样例。
- 不同 Agent 运行环境下的安装和预授权问题。
- 自部署 server 的部署脚本和运维经验。
- 本地升级检查、云任务迭代、MR 审批流程的改进。

提交 PR 前建议先跑：

```bash
pnpm test
pnpm run typecheck
pnpm run build
```

PR 描述请尽量包含：

- 改了什么。
- 为什么需要改。
- 如何验证。
- 是否影响 feedback payload、数据库 schema、全局 AGENTS 预授权或 skill 安装路径。

## 安全说明

该工具面向自部署场景，默认不脱敏。不要把公开 demo server 暴露给不可信网络；不要把密钥、环境变量、凭证、浏览器数据或无关文件内容写入 feedback payload。

## License

MIT
