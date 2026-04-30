---
phase: 21-distribution-live-validation
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
autonomous: true
requirements: [DIST-01]
must_haves:
  truths:
    - "package.json version 字段为 1.4.0"
    - "package.json author 字段为 Makoto"
    - "repository.url 格式为 git+https:// 开头"
    - "npm publish --dry-run 零 error 通过"
  artifacts:
    - path: "package.json"
      provides: "publishable package manifest"
      contains: '"version": "1.4.0"'
  key_links:
    - from: "package.json"
      to: "npm registry"
      via: "npm publish --dry-run"
      pattern: '"version": "1\.4\.0"'
---

<objective>
将 package.json 升至 v1.4.0 并使 npm publish --dry-run 零错误通过。

Purpose: Chronicle v1.4 milestone 完成，需要正确的 version/author 元数据才能发布。
Output: 更新后的 package.json；npm publish --dry-run 输出无 error。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: 更新 package.json 元数据字段并运行 npm pkg fix</name>
  <files>package.json</files>
  <read_first>
    - package.json (全文，已知当前内容：version=1.1.0，缺 author 字段，repository.url 缺 git+ 前缀)
  </read_first>
  <action>
对 package.json 做三处精确修改（per DIST-01, DIST-02, DIST-03）：

1. 将 `"version": "1.1.0"` 改为 `"version": "1.4.0"` (per DIST-01)

2. 在 `"license": "MIT"` 行后插入：
   `"author": "Makoto",`
   (per DIST-02；字段顺序按项目约定：license 之后，repository 之前)

3. 将 repository.url 从：
   `"url": "https://github.com/zxuexingzhijie/clichat.git"`
   改为：
   `"url": "git+https://github.com/zxuexingzhijie/clichat.git"`
   (per DIST-03；npm canonical format)

修改完成后，运行：
```
npm pkg fix
```
npm pkg fix 会自动规范化 repository.url（若手动改了格式正确则不变），确保无残留 warn。

不修改任何依赖字段、scripts、engines 或其他字段。
  </action>
  <verify>
    <automated>
      # 验证 version
      node -e "const p=require('./package.json');if(p.version!=='1.4.0')throw new Error('version mismatch:'+p.version)"
      # 验证 author
      node -e "const p=require('./package.json');if(p.author!=='Makoto')throw new Error('author missing or wrong:'+p.author)"
      # 验证 repository.url 格式
      node -e "const p=require('./package.json');if(!p.repository.url.startsWith('git+'))throw new Error('url not normalized:'+p.repository.url)"
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep '"version": "1.4.0"' package.json` → 有输出
    - `grep '"author": "Makoto"' package.json` → 有输出
    - `grep 'git+https://' package.json` → 有输出
  </acceptance_criteria>
  <done>package.json 三处字段均正确，grep 全部命中</done>
</task>

<task type="auto">
  <name>Task 2: 运行 npm publish --dry-run 确认零 error</name>
  <files></files>
  <read_first>
    - package.json (Task 1 修改后的结果)
  </read_first>
  <action>
运行以下命令验证发布就绪状态：
```
npm publish --dry-run
```

预期输出：
- 退出码 0
- 输出中包含 `chronicle-cli@1.4.0` 文件列表（dist/cli.js、world-data/、README.md、LICENSE）
- 零行含 `npm error`
- warn 行（如有）可接受，不阻塞

若出现 `npm error`：
- 检查 package.json 格式合法性（JSON parse）
- 检查 `files` 字段中列出的文件是否实际存在（dist/cli.js 在 prepublishOnly build 之后才存在，dry-run 会运行 prepublishOnly）
- 若 build 失败，检查 `bun run build` 输出

注意：npm publish --dry-run 会触发 prepublishOnly（即 `bun run build`）。build 需要 bun 环境，确保命令在项目根目录执行。
  </action>
  <verify>
    <automated>npm publish --dry-run 2>&1 | grep -v "npm warn" | grep -c "npm error" | xargs -I{} test {} -eq 0</automated>
  </verify>
  <acceptance_criteria>
    - `npm publish --dry-run` 退出码为 0
    - 输出中无任何 `npm error` 行
    - 输出中包含 `chronicle-cli@1.4.0`
  </acceptance_criteria>
  <done>npm publish --dry-run 零 error 通过，版本号在输出中显示为 1.4.0</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| package.json → npm registry | 发布元数据（name/version/author/repository）经 npm 验证；干跑不传输实际数据 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-01 | Tampering | package.json repository.url | mitigate | 仅接受 git+https:// 格式；npm pkg fix 规范化后 grep 验证 |
| T-21-02 | Information Disclosure | package.json author 字段 | accept | author 为公开发布信息，无敏感数据 |
| T-21-03 | Spoofing | npm package name chronicle-cli | accept | 名称已注册或为首次发布；dry-run 不实际推送 |
</threat_model>

<verification>
```bash
# 全量验证序列
grep '"version": "1.4.0"' package.json
grep '"author": "Makoto"' package.json
grep 'git+https://' package.json
npm publish --dry-run 2>&1 | grep "npm error" | wc -l
# 最后一条应输出 0
```
</verification>

<success_criteria>
- package.json version = 1.4.0 (per DIST-01)
- package.json author = "Makoto" (per DIST-02)
- repository.url = "git+https://github.com/zxuexingzhijie/clichat.git" (per DIST-03)
- npm publish --dry-run 退出码 0，零 npm error (per DIST-03)
</success_criteria>

<output>
After completion, create `.planning/phases/21-distribution-live-validation/21-P01-SUMMARY.md`
</output>
