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

不得使用 `0.0.0.0` 作为请求目标，`0.0.0.0` 只能作为 server 监听地址。不得猜测、轮询或广播到其他 feedback server。

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

本地自动化可以定期检查本 skill 打包指定 feedback server 的最新 MR 元信息接口：

```text
GET ${server_url}/api/latest-merge-request
```

如果返回的 `head_commit_hash` 与本地已记录 hash 不同，则说明该 scope 的 skill 仓库存在新的升级候选。自动化应提示用户审查 MR 或同步仓库，不得自动合并。
