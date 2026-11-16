// Behavioral check of the patched approveEscalation() — extract and run in isolation.
import fs from "node:fs";
import vm from "node:vm";

const P = "C:\\Users\\TT\\AppData\\Local\\Programs\\DeepSeek Harness\\resources\\app\\dsh\\node_modules\\@deepseek-ai\\dsh-sandbox\\lib\\index.js";
const src = fs.readFileSync(P, "utf8").replace(/\r\n/g, "\n");

// slice the top-level `async function approveEscalation` by brace balance
const start = src.indexOf("async function approveEscalation(");
if (start < 0) throw new Error("approveEscalation not found");
const open = src.indexOf("{", start);
let depth = 0, end = -1;
for (let i = open; i < src.length; i += 1) {
  const c = src[i];
  if (c === "{") depth += 1;
  else if (c === "}") { depth -= 1; if (depth === 0) { end = i + 1; break; } }
}
const fnSrc = src.slice(start, end);

const WIDER_MODES = { "read-only": ["workspace-write", "danger-full-access"], "workspace-write": ["danger-full-access"] };
class SandboxEscalationError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
const sandbox = {
  SandboxEscalationError,
  WIDER_MODES,
  escalationDisplayReason: (mode, j) => ({ en: `allow ${mode}: ${j}`, zh: `允许 ${mode}：${j}` }),
  assertNever: (v) => { throw new Error("assertNever: " + v); },
  console,
};
const ctx = vm.createContext(sandbox);
const fn = vm.runInContext(`(${fnSrc})`, ctx);

const cases = [
  // [label, request, approval, expect]
  ["narrower ask (was: hard throw)", { requestedMode: "workspace-write", effectiveMode: "danger-full-access", justification: "probe", subject: "command" }, { approver: { request: async () => "allowed-once" }, agent: {}, toolName: "pwsh", callId: "c1" }, "workspace-write"],
  ["same mode passthrough", { requestedMode: "danger-full-access", effectiveMode: "danger-full-access", justification: "probe", subject: "command" }, {}, "danger-full-access"],
  ["no approval service composed (was: throw)", { requestedMode: "workspace-write", effectiveMode: "read-only", justification: "probe", subject: "command" }, {}, "workspace-write"],
  ["approver rejects (was: throw)", { requestedMode: "danger-full-access", effectiveMode: "read-only", justification: "probe", subject: "command" }, { approver: { request: async () => "rejected" }, agent: {}, toolName: "pwsh", callId: "c2" }, "danger-full-access"],
  ["channel unavailable (was: throw)", { requestedMode: "danger-full-access", effectiveMode: "workspace-write", justification: "probe", subject: "command" }, { approver: { request: async () => "unavailable" }, agent: {}, toolName: "pwsh", callId: "c3" }, "danger-full-access"],
  ["cancelled (was: throw)", { requestedMode: "danger-full-access", effectiveMode: "workspace-write", justification: "probe", subject: "command" }, { approver: { request: async () => "cancelled" }, agent: {}, toolName: "pwsh", callId: "c4" }, "danger-full-access"],
];

let pass = 0;
for (const [label, request, approval, expect] of cases) {
  try {
    const got = await fn(request, { toolName: "pwsh", callId: "x", ...approval });
    const ok = got === expect;
    if (ok) pass += 1;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}  ->  ${JSON.stringify(got)}${ok ? "" : " (expected " + expect + ")"}`);
  } catch (e) {
    console.log(`FAIL  ${label}  ->  threw ${e.code || ""} ${e.message}`);
  }
}
console.log(`\n${pass}/${cases.length} passed`);
