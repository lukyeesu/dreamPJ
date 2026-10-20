# Workspace Rules & Git Deployment Policy

## Git Operations
- **Strictly DO NOT run `git add`, `git commit`, or `git push`**: The user manually stages, commits, and pushes code to Git/production.
- Read-only Git commands like `git status`, `git diff`, and `git log` are allowed.

---

## Active Skills & Engineering Directives

### 1. Ponytail (Lazy Senior Dev Mode)
- **Smallest complete change**: Solve problems with the least code possible. The best code is code never written.
- **Minimal diff & zero bloat**: No speculative features, no unnecessary wrapper/abstraction. Deletion beats addition.
- **Token efficiency**: Keep changes surgical and concise to save tokens and minimize bugs.
- **Reporting**: Always state at the end what was skipped/deferred and any residual risk.

### 2. OmniRoute (Provider & Model Fallback)
- When primary quota/tokens are exhausted, fall back seamlessly to free/lightweight models or subagents (`flash_lite` / `flash` or configured free routing providers).

### 3. Graphify (Codebase Knowledge Graph)
- Maintain and consult the project knowledge map (`graphify-out/` or index) to query architecture, relations, and symbols without reading every file from scratch every time.
- Automatically update the graph (`python -m graphify update .` or `--force` on deletion) whenever new pages/features are added or major refactoring occurs.

### 4. Agent Skills (Engineering Best Practices)
- Apply professional engineering standards: clean architecture, frontend/backend design patterns, domain modeling, and strict lint/type compliance.

### 5. Karpathy Skills (The 4 Golden Rules)
1. **Think Before Coding**: Never guess or assume. Surface tradeoffs and ask when uncertain.
2. **Simplicity First**: Minimum viable code. No abstractions for single-use logic.
3. **Surgical Changes**: Touch only what you must. Do not touch or reformat unrelated files/code.
4. **Goal-Driven Execution**: Define verifiable success criteria. Loop and verify before declaring completion.

### 6. ECC (Explore → Plan → Execute → Check / Self-Verify)
- Plan clearly before coding.
- Test and verify work independently (build, syntax, run tests or self-check) before handing off to the user.

### 7. Matt Pocock Skills (Ask Before Doing)
- Always ask and clarify with the user before committing to non-trivial changes or assumptions.
- Present concrete options and tradeoffs so the user can make informed decisions.

### 8. MCP for Review
- Utilize available MCP tools (such as `chrome-devtools` for UI inspection, console error tracking, and visual review) and code review workflows to audit code before finalizing.

