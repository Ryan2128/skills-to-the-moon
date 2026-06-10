# Skill 反馈闭环系统设计

## 背景

`skills-to-the-moon` 是一个面向 Agent Skill 的反馈闭环系统。它的目标不是让 skill 每次被纠错后立刻自我修改，而是把用户纠错沉淀成可追踪的反馈样本，再通过周期性 AI 归纳、MR 审批和人工合并，把高价值经验升级到 skill 仓库。

系统核心能力有三类：

- 可自迭代：从纠错样本中提取典型错误示例，并在满足条件时升级 `SKILL.md`。
- 可监控：记录 skill 调用情况和纠错反馈，提供监控页面。
- 可追踪：记录纠错事件中的 skill 名称、工作目录、技术栈、AI 输出和用户纠错输入。

## 总体架构

系统由四个部分组成：

1. Agent Runtime
2. Feedback Server
3. Agent 云任务
4. 用户本地自动化

职责划分如下：

```text
Agent Runtime
  -> 注入反馈规则 skill
  -> 记录真实业务 skill 的调用
  -> 判断用户下一条输入是否纠错
  -> 仅在命中被纠错的 skill_name 时上报

Feedback Server
  -> 接收 skill 调用事件
  -> 接收纠错反馈事件
  -> 展示 skill 调用监控页面
  -> 按日期范围导出反馈 CSV
  -> 提供最新 MR 元信息和 head commit hash
  -> 在系统管理页面提供合并后清理入口

Agent 云任务
  -> 每 X 天发起一个 iteration_slot
  -> 从 server 拉取日期区间内的反馈 CSV
  -> 判断执行小迭代还是大迭代
  -> 调 AI 归纳 EXAMPLES.md 和 SKILL.md 更新
  -> 创建分支、提交、打开 MR、评论 owner
  -> 将 MR 元信息回写 server

用户本地自动化
  -> 使用反馈规则 skill 的升级规则
  -> 定期检查 server 最新 MR 元信息
  -> 判断 skill 仓库是否有新升级候选
```

系统默认服务一个自部署 skill 仓库，不支持多仓库和多团队隔离。owner 就是该 skill 仓库的 owner。

## Feedback Skill

系统使用一个专门的反馈规则 skill 为 AI 注入反馈判断和上报规则。

该 skill 有特殊豁免：

- 不计入反馈统计。
- 不接收自动反馈。
- 不作为 `skill_name` 上报。
- 用户纠错该 skill 的行为不触发反馈上报。

它的职责是告诉 Agent Runtime：

- 什么时候判断用户输入是否为纠错。
- 如何区分纠错、引导、补充、混合和未知输入。
- 什么时候允许上报。
- 如何检查 server 最新 MR 元信息。
- 如何判断本地 skill 仓库是否有待吸收的升级。

## 纠错判断

每次 AI 输出后，用户的下一条输入都进入分类流程。这里的“下一条输入”不是指会话第二条输入，而是任意一次 AI 输出后的下一条用户输入。

纠错定义为：

> 用户认为上一轮 AI 输出存在错误、遗漏、偏离或不满足要求，并且这个反馈需要改变上一轮输出的判断、内容或后续行为。

典型纠错信号包括：

- 明确否定：`不对`、`错了`、`不是这个`、`你理解错了`
- 指出欠缺：`没考虑 X`、`少了 Y`、`不完整`、`没有覆盖`
- 替换性纠正：`应该是 X`、`我说的是 Y`
- 结果性纠错：`跑不通`、`报错`、`不符合规则`
- 边界纠错：`这个只适用于 X，不适用于 Y`

不应算纠错的情况包括：

- 单纯补充新背景。
- 单纯调整下一步方向。
- 普通偏好表达。
- 新需求追加，且没有否定上一轮输出。

如果一条输入同时包含补充和纠错，只要它明确指向上一轮输出的问题，就按纠错处理。

## 分类结果与置信度

分类器输出结构如下：

```json
{
  "input_type": "correction | guidance | supplement | mixed | unknown",
  "confidence": 0.0,
  "matched_signals": ["explicit_negation", "missing_requirement"],
  "target_skill_name": "skill-name",
  "reason": "用户指出上一轮输出缺少监控逻辑"
}
```

阈值规则：

- `confidence >= 0.8`：直接上报。
- `0.6 <= confidence < 0.8`：上报，并标记为 `needs_batch_review`。
- `confidence < 0.6`：不上报。

只有同时满足以下条件时才上报：

- 输入被判断为纠错或包含纠错的混合输入。
- 纠错指向一个真实业务 skill。
- 该 skill 是用户主动触发，或 AI 根据输入匹配调用过的 skill。
- 该 skill 不是反馈规则 skill。

没有调用 skill 的普通对话不进入反馈上报。一次上报只记录需要纠错的 `skill_name`。

## 技术栈识别

`tech_stack` 优先从 repo 文件中检测：

- `package.json`
- `pyproject.toml`
- `go.mod`
- `Cargo.toml`
- `pom.xml`
- `build.gradle`
- 其他常见语言和框架配置文件

当 repo 文件无法识别时，才由 AI 根据工作目录、文件路径、命令输出和对话上下文推断。

## 数据模型

### Skill 调用事件

server 需要接收所有真实业务 skill 的调用事件，用于监控页面统计调用量和纠错率。

最小字段：

```json
{
  "id": 1,
  "skill_name": "string",
  "working_directory": "string",
  "tech_stack": ["string"],
  "started_at": "datetime",
  "finished_at": "datetime",
  "status": "success | failed | unknown"
}
```

### 纠错反馈事件

最小字段：

```json
{
  "id": 1200,
  "skill_name": "string",
  "working_directory": "string",
  "tech_stack": ["string"],
  "ai_output": "string",
  "user_correction_input": "string",
  "classification_confidence": 0.86,
  "needs_batch_review": false,
  "created_at": "datetime"
}
```

该工具部署在用户本机或团队 dev server 上，不默认做脱敏。原始反馈会在大迭代 MR 合并并经系统管理页面确认后物理删除。

## Server API

server 只承担数据面和管理面职责，不发起 AI 迭代。

### 接收 skill 调用事件

```text
POST /api/skill-invocations
```

用途：

- 记录真实业务 skill 调用。
- 支撑监控页面展示调用量、失败率和纠错率。

### 接收纠错反馈

```text
POST /api/feedback
```

用途：

- 保存用户纠错事件。
- 为后续小迭代和大迭代提供原始样本。

### 导出反馈 CSV

```text
GET /api/feedback.csv?from=YYYY-MM-DD&to=YYYY-MM-DD
```

用途：

- Agent 云任务按日期范围拉取反馈。
- 接口返回 CSV 文件。

CSV 至少包含：

```text
id,skill_name,working_directory,tech_stack,ai_output,user_correction_input,classification_confidence,needs_batch_review,created_at
```

### 最新 MR 元信息

```text
GET /api/latest-merge-request
```

返回示例：

```json
{
  "mr_url": "string",
  "head_commit_hash": "string",
  "iteration_type": "minor | major",
  "feedback_id_start": 1200,
  "feedback_id_end": 1488,
  "status": "open | merged | closed",
  "merged_at": "datetime"
}
```

用途：

- 用户本地自动化判断是否有新 MR。
- 系统管理页面判断是否有合并后的反馈可清理。

### 记录 MR 元信息

```text
POST /api/merge-requests
```

Agent 云任务在打开 MR 后调用该接口，把 MR 信息回写 server。

请求示例：

```json
{
  "mr_url": "string",
  "title": "[skills-feedback][minor][feedback:1200-1488] 2026-06-17 skill updates",
  "head_commit_hash": "string",
  "iteration_type": "minor | major",
  "feedback_id_start": 1200,
  "feedback_id_end": 1488,
  "status": "open",
  "opened_at": "datetime"
}
```

server 可以通过该记录提供最新 MR 查询和系统管理清理入口。

### 系统管理清理入口

清理入口放在 server 网页系统管理页面中，不提供任意日期范围删除。

规则：

- 只允许有新的 MR 合并之后进行清理。
- server 识别 MR 标题中的反馈 ID 范围。
- 系统管理页面需要在清理前确认该 MR 已合并。
- 管理员确认后，server 物理删除该范围内的反馈记录。
- 清理后记录审计日志。

推荐 MR 标题格式：

```text
[skills-feedback][minor][feedback:1200-1488] 2026-06-17 skill updates
[skills-feedback][major][feedback:1200-1850] 2026-07-08 skill review
```

系统管理页面展示：

- MR 标题
- MR URL
- head commit hash
- MR 状态
- feedback ID 范围
- 预计清理记录数
- 清理确认按钮

## 迭代调度

迭代发起者是 Agent 云任务，不在 server 内执行。

配置项：

```json
{
  "minor_iteration_interval_days": 7,
  "major_iteration_every_n_slots": 4
}
```

每 X 天产生一个 `iteration_slot`。

```text
如果 iteration_slot % Y != 0：
  执行小迭代

如果 iteration_slot % Y == 0：
  不执行该槽位的小迭代
  改为执行大迭代
```

示例：`X=7`、`Y=4`。

```text
第 7 天：小迭代 #1
第 14 天：小迭代 #2
第 21 天：小迭代 #3
第 28 天：大迭代 #4，不执行小迭代 #4
第 35 天：小迭代 #5
```

## 小迭代

小迭代处理当前周期内的反馈。

流程：

```text
拉取当前周期反馈 CSV
-> AI 分类和归纳
-> 提取典型错误示例
-> 判断是否存在可升级规则
-> 更新 EXAMPLES.md 和 SKILL.md
-> 创建分支
-> 提交改动
-> 打开 MR
-> 评论 owner 审批
```

小迭代 MR 合并与否不影响后续迭代。小迭代处理过的反馈不物理删除，只保留为大迭代回顾素材。

## 大迭代

大迭代处理自上一次大迭代之后的全部反馈，包括已经被小迭代处理过的反馈。

流程：

```text
拉取大迭代窗口内全部反馈 CSV
-> 重新提取、归纳、总结
-> 验证 skill 是否已经升级
-> 判断是否还有内容可提升
-> 更新 EXAMPLES.md 和 SKILL.md
-> 创建分支
-> 提交改动
-> 打开 MR
-> 评论 owner 审批
```

大迭代不等待未合并的小迭代 MR。它基于当前主分支状态和原始反馈重新判断。

大迭代 MR 合并后，系统管理页面允许管理员按 MR 标题中的反馈 ID 范围物理删除对应反馈。

## EXAMPLES.md 规则

典型错误示例写入对应 skill 的 `EXAMPLES.md`。

格式：

```markdown
## 示例：标题

### 错误场景

简洁描述触发错误的上下文。

### 错误输出

摘录或概括错误输出，避免冗长。

### 正确做法

说明应如何处理。

### 适用边界

说明该示例适用和不适用的范围。

### Demo

给出最小可理解示例。
```

要求：

- 精炼。
- 准确。
- 有 demo。
- 不堆砌原始长文本。
- 不把一次偶发错误包装成通用规则。

## SKILL.md 升级规则

只有满足以下条件时，错误模式才可以上升到 `SKILL.md`：

- 同一类问题重复出现。
- 影响明显。
- 可归纳成稳定规则。
- 不和现有规则冲突。
- 如果存在冲突，必须标明适用边界。

`SKILL.md` 应记录稳定行为规则，不承载大量案例细节。案例细节优先进入 `EXAMPLES.md`。

## MR 规则

每个迭代期只开一个 MR。大迭代替代对应槽位的小迭代，也只开一个 MR。

MR 标题必须包含：

- 固定前缀：`[skills-feedback]`
- 迭代类型：`[minor]` 或 `[major]`
- 反馈 ID 范围：`[feedback:start-end]`
- 日期和简短说明

MR 评论应包含：

- 本次处理的反馈数量。
- 涉及的 skill 列表。
- 新增或更新的 `EXAMPLES.md` 数量。
- 升级到 `SKILL.md` 的规则数量。
- 需要 owner 重点审查的边界或冲突。

## 监控页面

server 提供 skill 调用情况监控页面。

最小视图：

- 总调用次数。
- 按 skill 聚合的调用次数。
- 按 skill 聚合的纠错次数。
- 按 skill 聚合的纠错率。
- 最近纠错反馈列表。
- 最近 MR 元信息。

该页面只服务自部署用户或团队，不做多租户隔离。

## 错误处理

### 上报失败

Agent Runtime 如果上报失败，应保留本轮对话继续能力，不阻塞用户任务。失败原因可以进入本地日志，但不应让反馈系统影响主要任务。

### CSV 导出失败

Agent 云任务应终止本次迭代，并记录失败原因。不得在样本不完整时创建 MR。

### AI 归纳失败

如果 AI 分类、提取或规则升级判断失败，本次迭代应失败退出，不创建空 MR。

### MR 创建失败

Agent 云任务应保留本地分支和提交信息，记录失败原因，等待下一次人工或自动重试。

### 清理失败

server 不得部分静默删除。清理过程需要记录成功删除数量；如果失败，应在系统管理页面展示失败状态，并保留未删除数据。

## 验证策略

实现阶段至少需要覆盖：

- 纠错分类阈值逻辑。
- feedback skill 豁免逻辑。
- 只有真实业务 skill 被纠错时才上报。
- 日期范围 CSV 导出。
- 最新 MR 元信息接口。
- MR 标题中 feedback ID 范围解析。
- 系统管理清理入口只允许已合并 MR 清理。
- 小迭代和大迭代槽位判断。
- 大迭代不等待未合并小迭代 MR。

## 已确定取舍

- server 不发起迭代，只负责接收、展示、导出和管理。
- 迭代发起者是 Agent 云任务。
- 清理入口放在网页系统管理中。
- 清理只允许在有新 MR 合并后进行。
- 开 MR 时，MR 名称记录反馈 ID 起始和结束位置。
- 小迭代按每 X 天执行。
- 大迭代按每 Y 个迭代槽位执行，并替代该槽位的小迭代。
- 大迭代不等待未合并小迭代 MR。
- 默认单 skill 仓库、自部署。
- 不默认脱敏。
