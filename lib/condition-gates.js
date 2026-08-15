export const CONDITION_GATE_TYPES = Object.freeze([
  "ifElse",
  "and",
  "or",
  "not",
  "nand",
  "nor",
  "xor",
  "xnor"
]);

const AUTO_FAN_OUT_GATES = new Set(["and", "or", "nand", "nor", "xor", "xnor"]);

const GATE_ALIASES = new Map([
  ["ifelse", "ifElse"],
  ["if/else", "ifElse"],
  ["if-else", "ifElse"],
  ["branch", "ifElse"],
  ["boolean", "ifElse"],
  ["yesno", "ifElse"],
  ["truefalse", "ifElse"],
  ["是否", "ifElse"],
  ["判断", "ifElse"],
  ["and", "and"],
  ["all", "and"],
  ["与", "and"],
  ["与门", "and"],
  ["or", "or"],
  ["any", "or"],
  ["或", "or"],
  ["或门", "or"],
  ["not", "not"],
  ["negate", "not"],
  ["非", "not"],
  ["非门", "not"],
  ["nand", "nand"],
  ["notand", "nand"],
  ["andnot", "nand"],
  ["与非", "nand"],
  ["与非门", "nand"],
  ["nor", "nor"],
  ["notor", "nor"],
  ["ornot", "nor"],
  ["或非", "nor"],
  ["或非门", "nor"],
  ["xor", "xor"],
  ["exclusiveor", "xor"],
  ["异或", "xor"],
  ["异或门", "xor"],
  ["xnor", "xnor"],
  ["equivalence", "xnor"],
  ["exclusiveornot", "xnor"],
  ["同或", "xnor"],
  ["同或门", "xnor"],
  ["异或非", "xnor"],
  ["异或非门", "xnor"]
]);

const BRANCH_ALIASES = new Map([
  ["true", "true"],
  ["yes", "true"],
  ["是", "true"],
  ["false", "false"],
  ["no", "false"],
  ["否", "false"],
  ["and", "and"],
  ["与", "and"],
  ["与门", "and"],
  ["or", "or"],
  ["或", "or"],
  ["或门", "or"],
  ["not", "not"],
  ["非", "not"],
  ["非门", "not"],
  ["nand", "nand"],
  ["与非", "nand"],
  ["与非门", "nand"],
  ["nor", "nor"],
  ["或非", "nor"],
  ["或非门", "nor"],
  ["xor", "xor"],
  ["异或", "xor"],
  ["异或门", "xor"],
  ["xnor", "xnor"],
  ["同或", "xnor"],
  ["同或门", "xnor"],
  ["异或非", "xnor"],
  ["异或非门", "xnor"]
]);

function compact(value) {
  return String(value ?? "").trim().replace(/[\s_-]+/g, "").toLowerCase();
}

export function normalizeGateType(value, fallback = "ifElse") {
  if (CONDITION_GATE_TYPES.includes(value)) return value;
  return GATE_ALIASES.get(compact(value)) ?? fallback;
}

export function gateBranchForEdge(edge) {
  const raw = edge?.sourceHandle ?? edge?.branch ?? edge?.logic;
  if (raw === true) return "true";
  if (raw === false) return "false";
  return BRANCH_ALIASES.get(compact(raw));
}

export function conditionGateType(node, outgoingEdges = []) {
  const explicit = node?.data?.gateType ?? node?.gateType;
  if (explicit !== undefined && explicit !== null && String(explicit).trim()) {
    return normalizeGateType(explicit);
  }
  const branches = new Set(outgoingEdges.map(gateBranchForEdge).filter(Boolean));
  if (branches.size === 1) {
    const [branch] = branches;
    if (branch === "not" || AUTO_FAN_OUT_GATES.has(branch)) return branch;
  }
  return "ifElse";
}

export function branchesForGate(gateType) {
  const gate = normalizeGateType(gateType);
  return gate === "ifElse" ? ["true", "false"] : [gate];
}

export function gateMaxOutgoing(gateType) {
  switch (normalizeGateType(gateType)) {
    case "ifElse": return 2;
    case "not": return 1;
    default: return Number.POSITIVE_INFINITY;
  }
}

export function availableGateBranches(gateType, outgoingEdges = [], excludeEdgeId = null) {
  const gate = normalizeGateType(gateType);
  const relevant = outgoingEdges.filter((edge) => edge?.id !== excludeEdgeId);
  if (AUTO_FAN_OUT_GATES.has(gate)) return [gate];
  if (gate === "not") return relevant.length === 0 ? ["not"] : [];
  const used = new Set(relevant.map(gateBranchForEdge).filter(Boolean));
  return ["true", "false"].filter((branch) => !used.has(branch));
}

export function validateGateBranch(gateType, outgoingEdges, branch, excludeEdgeId = null) {
  const gate = normalizeGateType(gateType);
  const normalizedBranch = gateBranchForEdge({ sourceHandle: branch });
  if (!branchesForGate(gate).includes(normalizedBranch)) {
    return { valid: false, code: "logicMismatch", gateType: gate, branch: normalizedBranch };
  }
  const available = availableGateBranches(gate, outgoingEdges, excludeEdgeId);
  if (!available.includes(normalizedBranch)) {
    return {
      valid: false,
      code: gate === "ifElse" ? "branchUsed" : "gateLimit",
      gateType: gate,
      branch: normalizedBranch
    };
  }
  return { valid: true, code: "ok", gateType: gate, branch: normalizedBranch };
}
