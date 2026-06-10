# 反馈规则示例 ${scope}

## 示例：明确纠错

### 错误场景

AI 使用 `${first_reportable_skill}` 后输出了错误判断，用户下一条输入明确否定上一轮输出。

### 错误输出

AI 把需要 owner 审批的 MR 流程说成可以自动合并。

### 正确做法

将用户输入分类为 `correction`，确认被纠错 skill 在 `feedback-rules-${scope}` 的 `reportable_skills` 白名单内，并按置信度规则上报到 `${server_url}`。

### 适用边界

仅适用于纠错指向本 scope 白名单内真实业务 skill 的情况。如果没有调用真实业务 skill、被纠错的是 `feedback-rules-${scope}` 本身、被纠错 skill 不在白名单内，或多个 `feedback-rules-*` 同时声明该 skill，则不上报。

### Demo

```text
AI：这个系统已经可以自动合并 MR。
用户：不对，MR 必须 owner 审批后才能合并。
分类：correction, confidence 0.95
动作：如果被纠错 skill 是 `${first_reportable_skill}` 且没有 scope 冲突，则上报到 `${server_url}`；否则不上报。
```
