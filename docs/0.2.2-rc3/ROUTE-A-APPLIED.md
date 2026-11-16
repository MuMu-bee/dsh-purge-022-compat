# 路线 A 执行记录：把 devin667 rc2.5 的 compat 层移植到本机 1.1.71

时间：2026-11-16 00:13–00:2x · 宿主：DSH Desktop 0.2.2-rc.3 · 插件：`dsh-purge 1.1.71`（realMisakaMikoto fork）

## 1. 做了什么

| 步骤 | 内容 |
|---|---|
| 备份 | `lib/_backup_20261116-001328/`（`core.js` / `extract-asar.js` / `redteam/index.js` 原件） |
| 新增 | `lib/compat-0.2.2.js`(62,712 B)、`lib/compat-0.2.3.js`(6,546 B) — 取自 devin667/dsh-purge-022 v1.1.71-rc2.5（MIT） |
| core.js 改动 1 | 第 35 行后加两行 import |
| core.js 改动 2 | `ALL_PATCHES` 包成 `applyCompat023(applyCompat([...]))` |
| core.js 改动 3 | `targetFiles()` 的 `files` 对象末尾并入 `...compatTargetKeys(aiBase, {...})` |

**`extract-asar.js` 未动** —— 本机这份的 `HOST_SYNC` 已含 `closeSync/readSync/writeSync/fsyncSync/fstatSync/accessSync`
（devin 版缺这 6 个，装上去会让 `.dshpurge.bak` 全量失败）。这是本机版相对 devin 的**唯一硬优势**，必须保留。

## 2. 补丁状态变化

```
移植前：  applied 63 / pending 9 / na 6 / missing_file 1
--apply 后：applied 72 / pending 0 / na 6 / missing_file 1
```

### 本轮新打上的 9 条（compat 才使得上的）

| # | 名称 | 落点 | marker 验证 |
|---|---|---|---|
| 12 | APPROVAL_ASK_SENTENCE_BYPASS | `dsh-tools/lib/types/pipeline.js` + `dsh-user-approval/lib/index.js` | 2 + 1 |
| 32 | WEB_SURFACE_IDENTITY_NEUTRAL | `dsh-harness-dev-context/lib/index.js` + `dsh-web-app/lib/index.js` | 3 + 1 |
| 45 | OFFICIAL_DESKTOP_UPDATE_HANDOFF | `resources/app/lib/main.js` | ✓ |
| 53 | WEB_SURFACE_PROHIBITION | `dsh-harness-dev-context` + `dsh-web-app` | 3 + 1 |
| 54 | DELIVERABLE_DO_NOT | `dsh-deliverable-file-references/lib/index.js` | 1 |
| 57 | DEEPSEEK_SYSTEM_ROLE | `@earendil-works/pi-ai` | ✓ |
| 60 | OFFICIAL_RUN_CODE_APPROVAL_NEUTRAL | `dsh-tool-executor-ptc/lib/index.js` | 1 |
| 62 | OFFICIAL_TOOL_ASK_FAILOPEN | `dsh-tools/lib/types/pipeline.js` | 2 |
| 82 | DESKTOP_SHELL_PROFILE_FALLBACK | `resources/app/lib/main.js:7551` | ✓ |

### 仍然是 na / missing_file 的 7 条（都是正常，不是失败）

| # | 原因 |
|---|---|
| 71 | `LIANGSHEN_IDENTITY_LINE` — 梁神插件没装，无目标文件 |
| 76 | `PRESET_UNRESTRICTED_IDENTITY_STRIP` — `preset-unrestricted` 不在本机 compositions |
| 28 | `LIANGSHEN_PHASE1_KEEP_INJECT` — 同上，梁神没装 |
| 30 / 31 | `HOOKS_CLAUDE_DENY_ALLOW` / `HOOKS_CODEX_DENY_ALLOW` — 没装 hooks 包 |
| 64 / 65 | `HOOKS_STOP_STEER_NEUTRAL` / `HOOKS_PRESTEP_REJECT_NEUTRAL` — 同上 |

### compat-0.2.3 顺带"退役"的两条

`#56 REWIND_HIDE_CUT_ONLY`、`#77 REWIND_DROP_SENT_ON_APPEND` 被 `applyCompat023()` 的
`RETIRED_023_IDS` 从 `ALL_PATCHES` 里移除（79 = 82 − 56 − 77 − 71 已在计数内）。
理由：rc.3 的 `dsh-client-ui-conversation/lib/client.js` 已是压缩 bundle，标识符被 mangle，
硬锚会在下次压缩换名时静默失效。**这两条在 rc.1/rc.2 上仍有效——若日后回退宿主，需从备份
恢复 `core.js` 或去掉 `applyCompat023` 的 splice。**

## 3. 验证

| 项 | 结果 |
|---|---|
| `node --check` core.js / compat-0.2.2.js / compat-0.2.3.js | 全部 exit=0 |
| `node --check` 7 个被新改写的宿主文件 | 0 失败 |
| `compatTargetKeys` 新键解析 | `dsh-tools-pipeline` 1 路径、`tool-executor-ptc` 2、`deliverable-file-references` 1、`dev-context` 1 |
| `--apply` | `cmd-flash=already_injected ok=true`，全部完成 |
| shim | 未定位 → 跳过（桌面宿主无 CLI shim，预期行为） |

## 4. 回滚

```powershell
$lib = "$env:DSH_HOME\profiles\desktop\node_modules\dsh-purge\lib"
Copy-Item "$lib\_backup_20261116-001328\core.js" $lib -Force
Remove-Item "$lib\compat-0.2.2.js","$lib\compat-0.2.3.js" -Force
# 再跑 /purge revert（或面板「还原」）把宿主侧 9 条撤回
```

宿主侧每条补丁都有 `.dshpurge.bak`，`/purge revert` 会原样还原。

## 5. 追加：红队预设自愈（2026-11-16 00:5x）

### 问题
`~/.dsh/.agent-presets/redteam/agent.cordis.yml` 里留着指向
`@deepseek-ai/dsh-tool-subagent-control/list-agents` 的 `disabled: false` 行。
0.2.2 已删该子路径（exports 只剩 `.` / `./src/*` / `./package.json` / `./locale/*.json`），
该行 `never started` → 整份预设 `registered-broken` → 模式下拉里红队消失。

### 修复
移植 devin667 rc2.5 的两个自愈函数到 `lib/redteam/index.js`（MIT，语义零改动）：

| 函数 | 作用 |
|---|---|
| `stripDeadSubagentRows(text)` | 整块摘掉 `name: @deepseek-ai/dsh-tool-subagent-control/<子路径>` 的行 |
| `stripToolFilter(text)` | 整块摘掉 `toolFilter:` 键（0.2.1-rc.2 起"键存在就抛"） |

自愈链从 3 段变 5 段：
```
renderSkillsDir → renderToolsPackage → stripToolFilter → stripDeadSubagentRows → repairDelegation
```
`installPreset()` 的 `repaired` 数组新增 `tool-filter` / `dead-subagent-rows` 两项。

### 验证
- 单元测试 16/16 PASS（`verify-strip-fns.mjs`）：删除正确、幂等、不误伤 group 嵌套与 maxDepth、双引号写法也认
- 真实文件：对已修复版跑 → `changed=false`；对 `agent.cordis.yml.bak-before-fix` 跑 → 390 → 386 行，死行清除、主入口保留
- 端到端（隔离 DSH_HOME 模拟插件重铺）：
  - 第一次 `force` 铺 → 带死行（包内模板本来就有）
  - 第二次自愈 → `action: repaired, repaired: "dead-subagent-rows+delegation"`，死行清零
  - 第三次 → `kept`，幂等

### 当前预设状态
- `agent.cordis.yml`：27,952 B / 390 行 / 32 个 `- id:` 行
- `name: ...list-agents` 行数：**0**
- 备份：`agent.cordis.yml.bak-before-fix`

（注：手动修复时写的那段说明性注释里含 `/list-agents` 字样，属文字，不是行声明。）

## 6. 生效方式

宿主 JS 在启动时载入 —— **必须重启 DeepSeek Harness**（连托盘一起退出再打开）。
重启后新开一轮对话，注入才进当前会话。
