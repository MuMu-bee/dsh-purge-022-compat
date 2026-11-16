// 移植后验证：在真宿主 aiBase 上跑 compat 后的 patchStatus，并列出新增键解析结果
import path from "node:path";
const CORE = new URL("../../lib/core.js", import.meta.url).href; // 仓库根目录下的 lib/core.js
const core = await import(CORE);

const AI_BASE = process.env.DSH_PURGE_AIBASE || path.join(process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local"), "Programs", "DeepSeek Harness", "resources", "app", "dsh", "node_modules", "@deepseek-ai");

console.log("ALL_PATCHES 总数 =", core.ALL_PATCHES.length);
const ids = core.ALL_PATCHES.map((p) => p.id);
console.log("id 范围 =", Math.min(...ids), "..", Math.max(...ids), "| 去重后 =", new Set(ids).size);
for (const gone of [56, 77]) {
  console.log(`#${gone} 是否被 compat-0.2.3 退役:`, ids.includes(gone) ? "仍在" : "已移除");
}

const files = core.targetFiles(AI_BASE);
const compatKeys = ["dsh-tools-pipeline", "tool-executor-ptc", "deliverable-file-references", "dev-context"];
console.log("\n--- compatTargetKeys 新增键 ---");
for (const k of compatKeys) {
  const v = files[k];
  const list = v == null ? [] : Array.isArray(v) ? v : [v];
  console.log(`${k.padEnd(28)} ${list.length ? list.length + " 个路径" : "未解析(本机没有该包)"}`);
  for (const p of list.slice(0, 3)) console.log("    ", p.replace(AI_BASE + "\\", ""));
}

console.log("\n--- patchStatus（compat 生效后）---");
const st = await core.patchStatus(AI_BASE);
const tally = {};
for (const [id, s] of Object.entries(st)) {
  tally[s] = (tally[s] || 0) + 1;
  if (s !== "applied") console.log(`  #${String(id).padEnd(3)} ${s}`);
}
console.log("合计:", JSON.stringify(tally));
