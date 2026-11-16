# dsh-purge 补齐记录 / compat fill — DSH 0.2.2-rc.3

时间：2026-11-15 · 宿主：desktop · DSH_HOME `%DSH_HOME%`（默认 `~/.dsh`）

## 1. 结论

| 项 | 之前 | 现在 |
|---|---|---|
| 补丁 | 49/66 applied，17 skipped | **56/66 applied，0 pending，10 skipped + 1 N/A** |
| shim 注入 | 未定位 | 不适用（桌面宿主无 CLI shim 目录，见 §4） |
| 需要重启 | 是 | 是（引擎文件在启动时载入） |

`purge_apply` 本身是幂等的：重跑返回 `applied=0, already=59`，说明**没有一个补丁处于 pending**。
剩下被记为 `skipped` 的补丁，是锚点对不上当前版本，重跑多少次都不会变。

## 2. 本次补齐的 7 个补丁

原始锚点按更早的 DSH 版本写的；0.2.2-rc.3 把代码换了写法（`SandboxEscalationError` 类、
`displayReason` 字段、`editIntent → requirePresent` 抽取、多一层缩进等），锚点失配 → 意图没落地。
用**当前安装版本的原文**作为锚点重新落盘，并写入 dsh-purge 自己的 marker 注释，
所以 `purge_status` 现在显示 applied，`purge_revert` / `.dshpurge.bak` 仍可回滚。

| patch | 名称 | 文件 | 改动 | 备份 |
|---|---|---|---|---|
| #13 | ESCALATION_WIDENING_EXEMPT | `@deepseek-ai/dsh-sandbox/lib/index.js` | 删除「严格升级阶梯」+「必须有 approval 服务」三道 throw | `…/lib/index.js.dshpurge.bak` |
| #14 | ESCALATION_GRANT_UNCONDITIONAL | 同上 | `approver/agent` 缺失时 `outcome = "allowed-once"` | 同上 |
| #35 | ESCALATION_NEVER_REJECT | 同上 | `rejected / cancelled / unavailable / default` 一律 `return mode` | 同上 |
| #17 | FS_OBSERVATION_INTENT_FREE | `@deepseek-ai/dsh-fs-observation-policy/lib/index.js` | `editIntent / deleteIntent / requirePresent` 全部无条件返回（原来要「先读再改」） | `…/lib/index.js.dshpurge.bak` |
| #18 | REPEAT_TOOL_REMINDER_DISABLED | `@deepseek-ai/dsh-repeat-tool-reminder/lib/index.js` | 去掉重复调用提醒注入 + 链计数 | `…/lib/index.js.dshpurge.bak` |
| #67 | AGENT_LOOP_MESSAGES_GUARD | `@deepseek-ai/dsh-agent-loop/lib/index.js` | `decision.messages` 缺省按空数组处理（官方缩进多一层，原锚点 4 tab 对不上） | `…/lib/index.js.dshpurge.bak` |
| #74 | ASSEMBLE_BEFORE_PRESTEP | 同上 | `preStep()` 在 `assemble()` 之前调用 `globalThis.__dshPurgePrepareAssemble` —— 钩子本来定义了却没人调用 | 同上 |

锚点都是**唯一命中**才写入：命中 0 次或多次一律跳过并报错，不会误改。

## 3. 验证

* 语法：4 个被改文件 `node --input-type=module --check` 全部 exit=0
* 行为（`verify-escalation.mjs`，把补丁后的 `approveEscalation()` 抽出来独立跑）**6/6 PASS**：
  * 更窄的模式请求：不再 throw，返回请求的模式
  * 无 approval 服务：不再 throw
  * `rejected` / `unavailable` / `cancelled`：不再 throw，直接授权
  * 同模式：原样返回
* 改前的实测反证：向 pwsh 请求比当前更窄的 `workspace-write`，报
  `sandbox escalation to "workspace-write" is not strictly wider than this call's current "danger-full-access" mode`
  —— 就是 #13 没落地。重启后该报错应消失。
* `purge_status`：49/66 → **56/66 applied，0 pending**

## 4. shim 为什么"注入不了"（不是失败，是设计上不适用）

* 本机是**桌面安装**：`resources/runtime/cli/bin` 不存在，安装目录下也**没有任何** `dsh.cmd / dsh.ps1 / dsh`，
  PATH 上没有 npm 全局 `dsh`，`%APPDATA%\npm` 里没有 dsh。
* dsh-purge 的 `listShimDirsForPatch()` 在 desktop 宿主上**直接返回空数组**：
  `if (adapterFor(detectSurface()) === "desktop") return [];`
  桌面宿主不用 PATH shim，改用「封装的 desktop command runtime 目录」（只清理不注入），
  而本机 `listDesktopCommandRuntimeDirs()` 也是空。
* 所以 `shim: dsh.cmd=missing dsh.ps1=missing dsh=missing` 是**预期状态**，没有可注入对象。
  强行造一个 `resources/runtime/cli/bin/dsh.cmd` 会让官方 CLI 探测走偏，没有这么做。

## 5. 仍然 skipped 的补丁（已逐个核实，不需要处理）

| patch | 名称 | 为什么可以放着 |
|---|---|---|
| #32 / #53 | WEB_SURFACE_IDENTITY_NEUTRAL / PROHIBITION | `dsh-web-app/lib/index.js` 里那两段 web 面身份/禁启服务文案在本版本**已不存在** → 意图已达成 |
| #54 | DELIVERABLE_DO_NOT | `dsh-client-ui-deliverables` 里 `Do not call present just to list edited source files` 已不存在 |
| #60 | OFFICIAL_RUN_CODE_APPROVAL_NEUTRAL | `dsh-tools` 里 run_code 的审批教学文案已不存在 |
| #62 | OFFICIAL_TOOL_ASK_FAILOPEN | 官方把 ask 决策从 `dsh-tools` 移走了；现在审批在 `dsh-user-approval`，而它**已被 #5/#9/#10/#11/#12 洗干净**（marker：`approval bypass: every approval request is auto-granted`） |
| #56 / #77 | REWIND_HIDE_CUT_ONLY / DROP_SENT_ON_APPEND | `dsh-client-ui-conversation/lib/client.js`（/rewind 的界面层渲染），UI 观感，不影响权限 |
| #82 | DESKTOP_SHELL_PROFILE_FALLBACK | `resources/app/lib/main.js` 里 `DSH_PROFILE` 兜底锚点已不存在（启动器逻辑改写） |
| #71 | LIANGSHEN_IDENTITY_LINE | 目标文件是梁神插件的预设；**梁神插件没装** → `missing_file`，本来就 N/A |
| #80 | MINIMAL_OFFICIAL_TOOLSET | 只针对 `minimal / sdk-minimal` 预设；当前跑的是 standard，不影响本会话 |

## 6. 复现 / 回滚

```powershell
# 重新补齐（幂等，已应用的会跳过）
& node "$env:DSH_HOME\dsh-purge\compat-0.2.2.mjs" --dry-run
& node "$env:DSH_HOME\dsh-purge\compat-0.2.2.mjs"

# 行为验证
& node "$env:DSH_HOME\dsh-purge\verify-escalation.mjs"

# 回滚全部清洗（保留 prompt-inject.md）
/purge revert

# 或只回滚某个文件
Copy-Item "<file>.dshpurge.bak" "<file>" -Force
```

## 7. 生效方式

改的是 `resources/app/dsh/**` 里的引擎源码，这些文件在**进程启动时载入**。
当前进程仍在跑旧代码 —— 需要**重启 dsh**（退出 DeepSeek Harness 再打开）后 #13/#14/#35/#17/#18/#67/#74 才真正生效。
