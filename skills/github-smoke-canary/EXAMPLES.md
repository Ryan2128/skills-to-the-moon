# GitHub Smoke Canary 示例

## 示例：保留故意错误输出并记录反馈闭环

### 错误场景

用户运行 `github-smoke-canary` smoke 验证时，skill 按设计输出错误 token，用于触发 `feedback-rules-github-smoke` 的纠错上报链路。

### 错误输出

```text
WRONG_TOKEN
```

### 正确做法

不要把 `SKILL.md` 中的首次输出改成正确 token。该错误是 canary 的验证入口；收到用户纠错后，应由 `feedback-rules-github-smoke` 将纠错反馈上报到 feedback server，并由迭代流程把该样例沉淀到本文件。

### 适用边界

仅适用于 `github-smoke-canary` 的反馈闭环 smoke 验证。真实业务 skill 被纠错时，应根据反馈内容判断是否需要更新 `EXAMPLES.md` 或提升到 `SKILL.md`，不能套用本 canary 的“故意错误”规则。

### Demo

```text
AI: WRONG_TOKEN
用户: 不对，正确的是 RIGHT_TOKEN
动作: 保留 canary 的故意错误输出，确认反馈事件被记录，并在升级 PR 中添加本示例。
```
