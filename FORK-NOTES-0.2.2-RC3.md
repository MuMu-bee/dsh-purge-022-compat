# FORK NOTES — DSH 0.2.2-rc.3 兼容层（本变体）

本仓库是 `dsh-purge 1.1.71` 的**兼容性副本**（compatibility build），目标是让这份插件继续跑在
**DeepSeek Harness 0.2.2-rc.3（desktop 宿主）** 上。不是上游发布分支，也不是任何一个上游的官方发行。

## 血统 / lineage

```
YuJunZhiXue/dsh-purge  1.1.71        (原作者：小杨, MIT, 上游仓库现已 404)
        └─ realMisakaMikoto/dsh-purge       基座 fork：修 0.2.1-rc.1 / 0.2.0-rc.2 三处（见 FORK-NOTES.md）
                └─ 本变体                    + DSH 0.2.2-rc.3 兼容层（compat 层取自 devin667/dsh-purge-022 v1.1.71-rc2.5, MIT）
```

## 相对基座 fork 改了什么

| 文件 | 改动 |
|---|---|
| `lib/compat-0.2.2.js` | **新增**（62,712 B）：换锚点 15 条，把补丁表对齐到 0.2.2-rc.1 的代码形状。采用「只追加、不替换」写法——新锚点追加到已有 `replacements` 末尾，老宿主先命中老锚点、新锚点静默跳过 |
| `lib/compat-0.2.3.js` | **新增**（6,546 B）：退役 `#56` / `#77`（rc.3 的 UI bundle 已压缩、标识符被 mangle，硬锚迟早静默失效） |
| `lib/core.js` | 三处接线：两个 `import`；`ALL_PATCHES` 包成 `applyCompat023(applyCompat([...]))`；`targetFiles()` 的 `files` 并入 `...compatTargetKeys(...)`。另含诊断增强（`promptDropReport` / `hostsUnwritten`） |
| `lib/redteam/index.js` | 移植 devin667 rc2.5 的两个自愈函数（语义零改动）：`stripDeadSubagentRows(text)` 摘掉指向已删子路径的 `@deepseek-ai/dsh-tool-subagent-control/<子路径>` 行；`stripToolFilter(text)` 摘掉 `toolFilter:` 键（0.2.1-rc.2 起「键存在即抛」）。自愈链 3 段 → 5 段：`renderSkillsDir → renderToolsPackage → stripToolFilter → stripDeadSubagentRows → repairDelegation` |
| `lib/extract-asar.js` | **未动**。本机基座的 `HOST_SYNC` 已含 `closeSync / readSync / writeSync / fsyncSync / fstatSync / accessSync` 六个同步方法（devin667 那版缺这 6 个，装上去会让 `.dshpurge.bak` 全量备份失败）——这是本变体相对同源分支的硬优势，必须保留 |
| `docs/0.2.2-rc3/` | 新增：本机的兼容补齐记录、验证脚本、可复现的 compat runner |

## 补丁落地情况（desktop 宿主 DSH 0.2.2-rc.3，实测）

补丁表 79 条 = 82 − `#56` − `#77` − `#71`（后三者已在计数内剔除/归为 N/A）。

| 状态 | 数量 | 说明 |
|---|---|---|
| applied | **72** | 全部落地，marker 可复核 |
| pending | **0** | 幂等：重跑返回 `applied=0` |
| n/a | 6 | `#30/#31/#64/#65` 未装 hooks 包；`#76` `preset-unrestricted` 不在 compositions；`#28` 未装梁神插件 |
| missing_file | 1 | `#71` 未装梁神插件，目标文件不存在 |

`shim: dsh.cmd / dsh.ps1 / dsh = missing` 是**预期状态**：桌面宿主的 `listShimDirsForPatch()` 直接返回空数组，
桌面宿主不使用 PATH shim，没有可注入对象。不是失败。

## 验证

| 项 | 结果 |
|---|---|
| `node --check` `core.js` / `compat-0.2.2.js` / `compat-0.2.3.js` | 全部 exit=0 |
| `node --check` 7 个被改写的宿主文件 | 0 失败 |
| `docs/0.2.2-rc3/verify-escalation.mjs`（沙箱升级放行行为） | **6/6 PASS** |
| `docs/0.2.2-rc3/verify-strip-fns.mjs`（预设自愈函数） | **16/16 PASS**，幂等、不误伤 group 嵌套与 `maxDepth` |
| 端到端（隔离 DSH_HOME 模拟重铺预设） | 第一次 `repaired` → 第二次 `kept`（幂等），死行清零 |
| 完整记录 | `docs/0.2.2-rc3/COMPAT-0.2.2-NOTES.md`、`docs/0.2.2-rc3/ROUTE-A-APPLIED.md` |

## 安装

```powershell
# tarball（推荐：不触发 pnpm 对 git 依赖 prepare 脚本的构建拦截）
dsh plugin --profile desktop add https://github.com/MuMu-bee/dsh-purge-022-compat/archive/refs/heads/main.tar.gz

# 或本地目录安装
dsh plugin --profile desktop add <本仓库路径>

# 或走 git（需要在该 profile 的 pnpm-workspace.yaml 里按提示放行 allowBuilds）
dsh plugin --profile desktop add github:MuMu-bee/dsh-purge-022-compat
```

装完**必须完全退出 DeepSeek Harness 再打开**：改的是 `resources/app/dsh/**` 引擎源码，这些文件在进程启动时载入；
当前进程仍跑旧代码。重启后新开一轮对话，注入才进当前会话。

补丁是**逐条锚点替换**：命不中就是 `skipped`，不会误改。应用前请自行审阅源码，并在应用前确认宿主版本。

## 回滚

```powershell
# 还原宿主侧全部补丁（每条都有 .dshpurge.bak）
/purge revert

# 或单文件还原
Copy-Item "<file>.dshpurge.bak" "<file>" -Force
```

宿主升级后重新补齐（幂等，已应用的会跳过）：

```powershell
node docs/0.2.2-rc3/compat-0.2.2.mjs --dry-run
node docs/0.2.2-rc3/compat-0.2.2.mjs
```

## 兼容性

| 宿主 | 建议 |
|---|---|
| **0.2.2-rc.3** | 本变体目标版本 |
| 0.2.2-rc.1 | 兼容层向后兼容 |
| 0.2.1 系列 / 0.2.0-rc.2 | 用基座 fork（realMisakaMikoto）或 `1.1.71-rc2.1` |
| 0.1.x | 不支持 |

## 署名与许可（必读）

* **原作者**：小杨 / [YuJunZhiXue](https://github.com/YuJunZhiXue/dsh-purge)（MIT）。上游明确要求：借用本项目的名称、思路、代码或提示词，**必须署名并写明来源仓库**。
* **基座 fork**：[realMisakaMikoto/dsh-purge](https://github.com/realMisakaMikoto/dsh-purge)（MIT）。
* **compat 层来源**：[devin667/dsh-purge-022](https://github.com/devin667/dsh-purge-022) `v1.1.71-rc2.5`（MIT）；本变体只做接线，语义零改动。
* **本仓库**：独立维护的兼容性副本，保留上游署名、版权与 MIT 许可证，不代表任何上游立场。
* 本仓库**不包含**：本机数据（`$DSH_HOME/redteam/config.json`、engagement 记录、密钥、凭据）、嵌入前的提示词原文（`lib/default-prompt-inject.md` 按 `.gitignore` 排除）。

## 用途

本机学习、个人项目与自动化实验；涉及他人系统前先取得授权。
