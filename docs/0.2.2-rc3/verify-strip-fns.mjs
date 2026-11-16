// 验证 stripDeadSubagentRows / stripToolFilter 的行为（含误伤与幂等）
const MOD = "file:///C:/Users/TT/.dsh/profiles/desktop/node_modules/dsh-purge/lib/redteam/index.js";
const { stripDeadSubagentRows, stripToolFilter } = await import(MOD);

let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => {
  if (cond) { pass++; console.log(`PASS  ${label}`); }
  else { fail++; console.log(`FAIL  ${label}${extra ? "  " + extra : ""}`); }
};

// ── 1. 删除 list-agents 死行 ──────────────────────────────────────────
const yml1 = [
  "  config:",
  "    - id: tool-subagent-control",
  "      name: '@deepseek-ai/dsh-tool-subagent-control'",
  "      disabled: false",
  "",
  "    - id: tool-subagent-list-agents",
  "      name: '@deepseek-ai/dsh-tool-subagent-control/list-agents'",
  "      disabled: false",
  "",
  "    - id: tool-subagent",
  "      name: '@deepseek-ai/dsh-tool-subagent'",
  "      disabled: false",
].join("\n");
const r1 = stripDeadSubagentRows(yml1);
ok(r1.changed === true, "死行被识别为需要修改");
ok(!r1.text.includes("list-agents"), "list-agents 行已删除");
ok(r1.text.includes("- id: tool-subagent-control"), "主入口行保留");
ok(r1.text.includes("- id: tool-subagent\n") || r1.text.includes("- id: tool-subagent"), "后续 tool-subagent 行保留");

// ── 2. 幂等：再跑一次不再改 ────────────────────────────────────────────
const r1b = stripDeadSubagentRows(r1.text);
ok(r1b.changed === false, "幂等：第二次运行 changed=false");
ok(r1b.text === r1.text, "幂等：第二次输出完全一致");

// ── 3. 不误伤：主入口行（无子路径）不动 ────────────────────────────────
const r3 = stripDeadSubagentRows(yml1.replace("      name: '@deepseek-ai/dsh-tool-subagent-control/list-agents'\n", ""));
ok(r3.changed === false, "不误伤：只有主入口时 changed=false");

// ── 4. 不误伤：带注释的 id 行、组行 ────────────────────────────────────
const yml4 = [
  "    - id: delegation",
  "      group: true",
  "      config:",
  "        - id: tool-subagent-control",
  "          name: '@deepseek-ai/dsh-tool-subagent-control'",
].join("\n");
const r4 = stripDeadSubagentRows(yml4);
ok(r4.changed === false, "不误伤：group 嵌套结构保持不变");

// ── 5. 双引号写法也要认 ────────────────────────────────────────────────
const yml5 = [
  "    - id: tool-subagent-list-agents",
  '      name: "@deepseek-ai/dsh-tool-subagent-control/list-agents"',
  "      disabled: false",
].join("\n");
ok(stripDeadSubagentRows(yml5).changed === true, "双引号 form 也能识别");

// ── 6. stripToolFilter：整块摘掉 ──────────────────────────────────────
const yml6 = [
  "      config:",
  "        provider: spawn",
  "        toolFilter:",
  "          deny:",
  "            - workflow",
  "            - ralph",
  "        maxDepth: 1",
].join("\n");
const r6 = stripToolFilter(yml6);
ok(r6.changed === true, "toolFilter 被识别");
ok(!r6.text.includes("toolFilter"), "toolFilter 键已删除");
ok(!r6.text.includes("deny"), "toolFilter 子块已删除");
ok(r6.text.includes("provider: spawn"), "前一行保留");
ok(r6.text.includes("maxDepth: 1"), "后一行保留");

// ── 7. stripToolFilter 幂等 ───────────────────────────────────────────
const r6b = stripToolFilter(r6.text);
ok(r6b.changed === false && r6b.text === r6.text, "stripToolFilter 幂等");

// ── 8. stripToolFilter 不误伤 maxDepth 等邻居 ─────────────────────────
ok(stripToolFilter("        maxDepth: 1").changed === false, "不误伤：maxDepth 不动");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
