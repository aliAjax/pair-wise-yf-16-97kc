// 双板配对验收台：数据模型与配对规则（纯逻辑，便于复用与测试）

export type Side = "L" | "R";

/** 底板损伤登记 */
export interface Damage {
  id: string;
  position: string; // 板头 / 板中 / 板尾 / 板刃附近
  desc: string;
  lengthCm?: number;
  repaired?: boolean;
}

/** 单板数据：侧刃角、底刃角、蜡型、底板损伤 */
export interface Board {
  sideEdge: number; // 侧刃角（度），常见 87~90
  baseEdge: number; // 底刃角（度），常见 0~2
  wax: string; // 蜡型
  damages: Damage[];
}

export type OrderStatus =
  | "pending" // 待验收
  | "passed" // 配对验收通过
  | "failed" // 差值超限，不能配对
  | "review"; // 通过后数据变动，待复核

/** 一次验收记录：客户历史保留每次验收差值 */
export interface Acceptance {
  id: string;
  at: number;
  passed: boolean;
  sideL: number;
  sideR: number;
  baseL: number;
  baseR: number;
  sideDiff: number;
  baseDiff: number;
  failures: string[]; // 超限时指明差在哪一侧
}

/** 验收通过时的快照，用于发现通过后的刃角 / 损伤变动 */
export interface Snapshot {
  sideL: number;
  sideR: number;
  baseL: number;
  baseR: number;
  damageL: string[];
  damageR: string[];
}

export interface Order {
  id: string;
  customer: string;
  boardType: string; // 板型：全地域 / 公园板 / 竞速板 / 粉雪板
  boardModel: string; // 品牌型号，如 Burton Custom 156
  createdAt: number;
  status: OrderStatus;
  left: Board;
  right: Board;
  history: Acceptance[];
  snapshot: Snapshot | null;
}

export type NewOrderInput = Pick<
  Order,
  "customer" | "boardType" | "boardModel" | "left" | "right"
>;

// ---- 常量 ----

export const SIDE_TOL = 0.5; // 侧刃差限值（度），超过即不能配对
export const BASE_TOL = 0.25; // 底刃差限值（度），超过即不能配对

export const BOARD_TYPES = ["全地域", "公园板", "竞速板", "粉雪板"] as const;
export const WAX_TYPES = ["低温蜡", "全温蜡", "高温蜡", "竞赛蜡", "未打蜡"] as const;
export const POSITIONS = ["板头", "板中", "板尾", "板刃附近"] as const;

export const STATUS_META: Record<
  OrderStatus,
  { label: string; variant: string; hint: string }
> = {
  pending: { label: "待验收", variant: "pending", hint: "工单已登记，等待执行配对验收" },
  review: {
    label: "待复核",
    variant: "review",
    hint: "验收通过后刃角或底板损伤有变动，需重新验收",
  },
  passed: { label: "已配对", variant: "passed", hint: "配对验收通过，可作为一副交付" },
  failed: { label: "不能配对", variant: "failed", hint: "刃角差值超限，原测量值已保留" },
};

// ---- 工具函数 ----

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const fmtAngle = (n: number) => round2(n).toFixed(2);

export function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function fmtTime(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---- 配对判定 ----

export interface Verdict {
  sideDiff: number;
  baseDiff: number;
  passed: boolean;
  failures: string[];
}

function gapMessage(
  name: string,
  left: number,
  right: number,
  diff: number,
  tol: number
): string {
  const direction =
    left === right
      ? ""
      : left > right
        ? `，左板偏大 ${fmtAngle(diff)}°`
        : `，右板偏大 ${fmtAngle(diff)}°`;
  return `${name}差 ${fmtAngle(diff)}° 超过限值 ${fmtAngle(tol)}°（左 ${fmtAngle(left)}° / 右 ${fmtAngle(right)}°${direction}）`;
}

/** 仅做判定，不改动任何原值 */
export function evaluate(o: Pick<Order, "left" | "right">): Verdict {
  const sideDiff = round2(Math.abs(o.left.sideEdge - o.right.sideEdge));
  const baseDiff = round2(Math.abs(o.left.baseEdge - o.right.baseEdge));
  const failures: string[] = [];
  if (sideDiff > SIDE_TOL) {
    failures.push(gapMessage("侧刃", o.left.sideEdge, o.right.sideEdge, sideDiff, SIDE_TOL));
  }
  if (baseDiff > BASE_TOL) {
    failures.push(gapMessage("底刃", o.left.baseEdge, o.right.baseEdge, baseDiff, BASE_TOL));
  }
  return { sideDiff, baseDiff, passed: failures.length === 0, failures };
}

// ---- 验收快照 ----

export function makeSnapshot(o: Pick<Order, "left" | "right">): Snapshot {
  return {
    sideL: o.left.sideEdge,
    sideR: o.right.sideEdge,
    baseL: o.left.baseEdge,
    baseR: o.right.baseEdge,
    damageL: o.left.damages.map((d) => d.id),
    damageR: o.right.damages.map((d) => d.id),
  };
}

function sameIds(a: Damage[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const x = a.map((d) => d.id).sort();
  const y = [...b].sort();
  return x.every((id, i) => id === y[i]);
}

/** 已通过验收的工单，刃角是否被改动或损伤是否有增删 */
export function isDrifted(o: Order): boolean {
  const s = o.snapshot;
  if (!s) return false;
  if (
    o.left.sideEdge !== s.sideL ||
    o.right.sideEdge !== s.sideR ||
    o.left.baseEdge !== s.baseL ||
    o.right.baseEdge !== s.baseR
  ) {
    return true;
  }
  return !sameIds(o.left.damages, s.damageL) || !sameIds(o.right.damages, s.damageR);
}

/** 执行一次验收：通过则固化快照，不通过则保留原值并记录差异所在侧 */
export function runAcceptance(o: Order): Order {
  const v = evaluate(o);
  const record: Acceptance = {
    id: uid(),
    at: Date.now(),
    passed: v.passed,
    sideL: o.left.sideEdge,
    sideR: o.right.sideEdge,
    baseL: o.left.baseEdge,
    baseR: o.right.baseEdge,
    sideDiff: v.sideDiff,
    baseDiff: v.baseDiff,
    failures: v.failures,
  };
  return {
    ...o,
    history: [...o.history, record],
    status: v.passed ? "passed" : "failed",
    snapshot: v.passed ? makeSnapshot(o) : null,
  };
}

export function nextOrderId(orders: Order[]): string {
  const max = orders.reduce((acc, o) => {
    const m = /^ORD-(\d+)$/.exec(o.id);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 105);
  return `ORD-${max + 1}`;
}
