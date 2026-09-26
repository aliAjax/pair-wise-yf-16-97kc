import type { Board, Order } from "./types";
import { runAcceptance } from "./types";

// 仅在浏览器中没有任何数据时加载的演示工单，便于前台直接上手
export function seedOrders(): Order[] {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  const scratch = (b: Board): Board => ({
    ...b,
    damages: b.damages.map((d) => ({ ...d })),
  });

  // 1) 历史上已配对的一副，之后左板侧刃被动过、右板新增损伤 → 待复核
  const o1Base: Order = {
    id: "ORD-118",
    customer: "王雪",
    boardType: "粉雪板",
    boardModel: "Burton Fish 158",
    createdAt: now - 12 * DAY,
    status: "pending",
    left: {
      sideEdge: 88.0,
      baseEdge: 0.75,
      wax: "低温蜡",
      damages: [{ id: "seed-d1", position: "板尾", desc: "浅划痕", lengthCm: 3, repaired: true }],
    },
    right: {
      sideEdge: 88.0,
      baseEdge: 0.75,
      wax: "低温蜡",
      damages: [{ id: "seed-d2", position: "板尾", desc: "浅划痕", lengthCm: 3, repaired: true }],
    },
    history: [],
    snapshot: null,
  };
  const accepted1 = runAcceptance(o1Base);
  accepted1.history = accepted1.history.map((h) => ({ ...h, at: now - 6 * DAY }));
  // 验收通过后发生的变动（前台当前看到的状态）
  const drifted1: Order = {
    ...accepted1,
    status: "review",
    left: {
      ...scratch(accepted1.left),
      sideEdge: 88.5, // 左板侧刃从 88.0° 调到 88.5°
    },
    right: {
      ...scratch(accepted1.right),
      damages: [
        ...accepted1.right.damages,
        { id: "seed-d3", position: "板中", desc: "底板新刮伤，待补 P-Tex", lengthCm: 6 },
      ],
    },
  };

  // 2) 侧刃差 0.75° / 底刃差 0.50°，均超限 → 不能配对，保留原值
  const o2: Order = {
    id: "ORD-121",
    customer: "李竞",
    boardType: "竞速板",
    boardModel: "Volkl Racetiger 165",
    createdAt: now - 2 * DAY,
    status: "pending",
    left: { sideEdge: 87.0, baseEdge: 1.0, wax: "竞赛蜡", damages: [] },
    right: { sideEdge: 87.75, baseEdge: 0.5, wax: "竞赛蜡", damages: [] },
    history: [],
    snapshot: null,
  };
  const rejected2 = runAcceptance(o2);
  rejected2.history = rejected2.history.map((h) => ({ ...h, at: now - DAY }));

  // 3) 差值合格，一次通过
  const o3: Order = {
    id: "ORD-124",
    customer: "陈默",
    boardType: "全地域",
    boardModel: "Ride Warpig 154",
    createdAt: now - DAY,
    status: "pending",
    left: {
      sideEdge: 89,
      baseEdge: 0.5,
      wax: "全温蜡",
      damages: [{ id: "seed-d4", position: "板头", desc: "轻微氧化", repaired: true }],
    },
    right: {
      sideEdge: 89.25,
      baseEdge: 0.5,
      wax: "全温蜡",
      damages: [{ id: "seed-d5", position: "板头", desc: "轻微氧化", repaired: true }],
    },
    history: [],
    snapshot: null,
  };
  const accepted3 = runAcceptance(o3);
  accepted3.history = accepted3.history.map((h) => ({ ...h, at: now - 3600 * 1000 }));

  // 4) 刚登记，还没验收
  const o4: Order = {
    id: "ORD-125",
    customer: "赵乐",
    boardType: "公园板",
    boardModel: "Capita DOA 152",
    createdAt: now,
    status: "pending",
    left: { sideEdge: 88, baseEdge: 0.5, wax: "全温蜡", damages: [] },
    right: { sideEdge: 88.5, baseEdge: 0.75, wax: "未打蜡", damages: [] },
    history: [],
    snapshot: null,
  };

  return [drifted1, rejected2, accepted3, o4];
}
