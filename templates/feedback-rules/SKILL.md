---
name: feedback-rules-${scope}
description: 用于 Agent 需要注入 ${scope} 范围内 skill 的纠错反馈上报规则、反馈豁免规则和升级检查规则时；该 skill 是系统协议 skill，不参与反馈闭环。
---

# 反馈规则 ${scope}

## 自身豁免

- 本 skill 名称为 `feedback-rules-${scope}`。
- 本 skill 不计入反馈统计。
- 本 skill 不接收自动反馈。
- 不得把本 skill 作为 skill_name 上报。
- 不得把任何 `feedback-rules-*` skill 作为 skill_name 上报。
- 用户纠错本 skill 时，不触发反馈上报。

## 反馈服务地址

本 skill 只向打包时指定的 feedback server 上报：

```text
${server_url}
```

不得使用 `0.0.0.0` 作为请求目标，`0.0.0.0` 只能作为 server 监听地址。server 地址不得包含 query 参数或 hash 片段。不得猜测、轮询或广播到其他 feedback server。

请求接口：

```text
POST /api/skill-invocations
POST /api/feedback
GET /api/latest-merge-request
```

发送请求时使用完整地址，例如 `POST ${server_url}/api/feedback`，并设置 `content-type: application/json`。

## 可反馈 skill 白名单

只处理 `reportable_skills` 列表内 skill 的纠错：

${reportable_skills_markdown}

```yaml
feedback_scope: ${scope}
feedback_server_url: ${server_url}
reportable_skills:
${reportable_skills_yaml}
```

同一条纠错只允许上报到一个 feedback server。如果多个 `feedback-rules-*` 同时声明同一个业务 skill，则视为配置冲突，不上报。

## Skill 调用上报

一旦本轮选择、读取或执行了 `reportable_skills` 列表内的真实业务 skill，就必须向 `${server_url}/api/skill-invocations` 上报一次调用事件。调用上报不等待用户纠错；即使用户后续没有纠错，也要记录该业务 skill 的调用。

调用上报是后台默认动作，不要用用户可见消息显式说明或打扰用户。除非用户询问上报状态，或上报失败会影响当前主要任务，否则不要在回复中提及调用上报。

不得上报本 `feedback-rules-${scope}` skill，也不得上报任何 `feedback-rules-*` skill。

`POST /api/skill-invocations` 的 payload 仅允许包含以下字段：

- `skill_name`：本轮被选择、读取或执行的真实业务 skill 名称，必须来自 `reportable_skills`。
- `working_directory`：调用发生时的工作目录。
- `tech_stack`：字符串数组，优先从 repo 文件中检测；无法识别时使用 `["unknown"]`。
- `started_at`：必须使用 UTC ISO 字符串，例如 `new Date().toISOString()`。
- `finished_at`：可选；如果能确认调用结束时间，必须使用 UTC ISO 字符串。
- `status`：`success`、`failed` 或 `unknown`。如果在最终回答前无法可靠判断结果，使用 `unknown`。

如果沙箱内无法访问本地 feedback server，但请求目标、endpoint、scope、skill 白名单和 payload 均符合用户全局 AGENTS.md 的 Feedback 上报预授权，可按权限流程请求非沙箱执行该本机 POST。

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
- 该 skill 出现在本 skill 的 `reportable_skills` 列表中。
- 该 skill 不是本 `feedback-rules-${scope}` skill，也不是任何 `feedback-rules-*` skill。
- 未发现其他 `feedback-rules-*` 同时声明该业务 skill。

只上报用户纠错指向的真实业务 skill。没有调用 skill 的普通对话不上报。纠错指向非白名单 skill 时不上报。

## 上报字段

`POST /api/feedback` 的 payload 仅允许包含以下字段：

- `skill_name`：用户纠错指向的真实业务 skill 名称。
- `working_directory`：发生纠错时的工作目录。
- `tech_stack`：字符串数组，优先从 repo 文件中检测；无法检测时再由 AI 根据上下文推断；无法识别时使用 `["unknown"]`。
- `ai_output`：上一轮 AI 对该 skill 的错误输出。
- `user_correction_input`：用户本轮纠错输入。
- `classification_confidence`：纠错分类置信度，范围为 0 到 1。
- `needs_batch_review`：当 `0.6 <= confidence < 0.8` 时为 `true`，否则为 `false`。
- `created_at`：必须使用 UTC ISO 字符串，例如 `new Date().toISOString()` 这类 `Z` 结尾的时间格式。

`tech_stack` 必须是字符串数组，不得写成单个字符串。`created_at` 必须使用 UTC ISO 字符串，不得使用本地时区偏移格式，例如 `+08:00`。

不得包含密钥、环境变量、凭证、任意文件内容、浏览器数据，或与本次纠错无关的数据。

## 升级检查规则

本地自动化可以定期检查本 skill 打包指定 feedback server 的最新 MR 元信息接口：

```text
GET ${server_url}/api/latest-merge-request
```

如果返回的 `head_commit_hash` 与本地已记录 hash 不同，则说明该 scope 的 skill 仓库存在新的升级候选。自动化应提示用户审查 MR 或同步仓库，不得自动合并。
