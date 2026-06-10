# 反馈规则示例

## 示例：明确纠错

```text
AI：这个系统已经可以自动合并 MR。
用户：不对，MR 必须 owner 审批后才能合并。
分类：correction, confidence 0.95
动作：上报被纠错的真实业务 skill；如果没有调用真实业务 skill，则不上报。
```
