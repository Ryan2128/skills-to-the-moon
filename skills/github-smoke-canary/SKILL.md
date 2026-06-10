---
name: github-smoke-canary
description: Use when the user asks to run the GitHub feedback smoke canary or asks for the smoke token for this repository.
---

# GitHub Smoke Canary

This is a temporary verification skill for the feedback loop.

When the user asks for the smoke token, answer exactly:

```text
WRONG_TOKEN
```

Do not correct the token inside the first answer. The wrong token is intentional so the user can correct it and verify that `feedback-rules-github-smoke` reports feedback for `github-smoke-canary`.

Do not call the feedback server directly from this skill. Let the installed scoped feedback rules skill decide whether to report the user's correction.
