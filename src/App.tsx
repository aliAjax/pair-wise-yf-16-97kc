import { useEffect, useMemo, useState } from "react";
import "./styles.css";

/* ---------------- 类型与配对规则 ---------------- */

type BoardSide = "L" | "R";
type PairStatus = "pending" | "paired" | "recheck" | "failed";

interface Damage {
  id: string;
  board: BoardSide;
  spot: string;
  note: string;
}

interface Order {
  id: string;
  customer: string;
  model: string;
  wax: string;
  leftSide: number; // 左板侧刃角（度）
  leftBase: number; // 左板底刃角（度）
  rightSide: number; // 右板侧刃角（度）
  rightBase: number; // 右板底刃角（度）
  damages: Damage[];
  status: PairStatus;
  updatedAt: number;
}

interface Acceptance {
  id: string;
  orderId: string;
  customer: string;
  model: string;
  at: number;
  sideDiff: number;
  baseDiff: number;
  sideHigh: BoardSide | null;
  baseHigh: BoardSide | null;
  passed: boolean;
}

interface State {
  orders: Order[];
  history: Acceptance[];
}

const SIDE_LIMIT = 0.5; // 侧刃差上限（度），超过即不能配对
const BASE_LIMIT = 0.25; // 底刃差上限（度），超过即不能配对

const STATUS_LABEL: Record<PairStatus, string> = {
  pending: "待验收",
  paired: "已配对",
  recheck: "待复核",
  failed: "配对失败",
};

const WAXES = ["低温蜡", "中温蜡", "高温蜡", "氟素蜡", "尚未打蜡"];

const STORAGE_KEY = "ski-pair-acceptance-v1";

/* ---------------- 工具函数 ---------------- */

const round2 = (n: number) => Math.round(n * 100) / 100;
const fmtAngle = (n: number) => (Number.isFinite(n) ? String(round2(n)) : "—");
const fmtDiff = (n: number) => (Number.isFinite(n) ? n.toFixed(2) : "—");
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const fmtTime = (t: number) =>
  new Date(t).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const sideText = (s: BoardSide | null) =>
  s === "L" ? "左板高" : s === "R" ? "右板高" : "两侧持平";

interface EvalResult {
  valid: boolean;
  sideDiff: number;
  baseDiff: number;
  sideHigh: BoardSide | null;
  baseHigh: BoardSide | null;
  sideOk: boolean;
  baseOk: boolean;
  passed: boolean;
}

function evaluate(o: Order): EvalResult {
  const valid = [o.leftSide, o.leftBase, o.rightSide, o.rightBase].every(Number.isFinite);
  const sideDiff = valid ? round2(Math.abs(o.leftSide - o.rightSide)) : NaN;
  const baseDiff = valid ? round2(Math.abs(o.leftBase - o.rightBase)) : NaN;
  const sideHigh =
    !valid || o.leftSide === o.rightSide ? null : o.leftSide > o.rightSide ? "L" : "R";
  const baseHigh =
    !valid || o.leftBase === o.rightBase ? null : o.leftBase > o.rightBase ? "L" : "R";
  const sideOk = valid && sideDiff <= SIDE_LIMIT;
  const baseOk = valid && baseDiff <= BASE_LIMIT;
  return { valid, sideDiff, baseDiff, sideHigh, baseHigh, sideOk, baseOk, passed: sideOk && baseOk };
}

/* ---------------- 初始数据与浏览器存储 ---------------- */

function seedState(): State {
  const now = Date.now();
  return {
    orders: [
      {
        id: "ORD-106",
        customer: "王磊",
        model: "Burton Custom 156 · 全能板",
        wax: "低温蜡",
        leftSide: 88,
        leftBase: 1,
        rightSide: 88.2,
        rightBase: 1.1,
        damages: [{ id: uid(), board: "R", spot: "板尾", note: "划痕约 3cm，未伤到底材" }],
        status: "pending",
        updatedAt: now - 5 * 3600_000,
      },
      {
        id: "ORD-112",
        customer: "陈雪",
        model: "竞速板 165",
        wax: "高温蜡",
        leftSide: 87.5,
        leftBase: 0.5,
        rightSide: 88.2,
        rightBase: 1,
        damages: [{ id: uid(), board: "L", spot: "板腰", note: "划痕 12cm，待补 P-Tex" }],
        status: "pending",
        updatedAt: now - 2 * 3600_000,
      },
      {
        id: "ORD-118",
        customer: "赵北",
        model: "粉雪板 158",
        wax: "氟素蜡",
        leftSide: 89,
        leftBase: 1,
        rightSide: 89.1,
        rightBase: 1.2,
        damages: [],
        status: "paired",
        updatedAt: now - 3600_000,
      },
    ],
    history: [
      {
        id: uid(),
        orderId: "ORD-118",
        customer: "赵北",
        model: "粉雪板 158",
        at: now - 3600_000,
        sideDiff: 0.1,
        baseDiff: 0.2,
        sideHigh: "R",
        baseHigh: "R",
        passed: true,
      },
    ],
  };
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      if (Array.isArray(parsed.orders) && Array.isArray(parsed.history)) return parsed;
    }
  } catch {
    /* 存储不可用时退回初始数据 */
  }
  return seedState();
}

/* ---------------- 主应用 ---------------- */

function App() {
  const [state, setState] = useState<State>(loadState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<PairStatus | "all">("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const { orders, history } = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* 仅存浏览器，写入失败时静默 */
    }
  }, [state]);

  const selected = orders.find((o) => o.id === selectedId) ?? null;
  const showDetail = selected !== null && !creating;

  const counts = useMemo(() => {
    const c: Record<PairStatus, number> = { pending: 0, paired: 0, recheck: 0, failed: 0 };
    orders.forEach((o) => {
      c[o.status] += 1;
    });
    return c;
  }, [orders]);

  const filteredOrders =
    statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  const customers = useMemo(
    () => Array.from(new Set(history.map((h) => h.customer))),
    [history]
  );
  const filteredHistory =
    customerFilter === "all" ? history : history.filter((h) => h.customer === customerFilter);

  /* ---- 状态变更 ---- */

  const patchOrder = (id: string, patch: Partial<Order>, touchesPairing = false) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== id) return o;
        // 配对通过后改动刃角/新增损伤 → 回到待复核
        const status: PairStatus =
          touchesPairing && o.status === "paired" ? "recheck" : o.status;
        return { ...o, ...patch, status, updatedAt: Date.now() };
      }),
    }));
  };

  const runAcceptance = (id: string) => {
    setState((s) => {
      const order = s.orders.find((o) => o.id === id);
      if (!order) return s;
      const ev = evaluate(order);
      if (!ev.valid) return s;
      const rec: Acceptance = {
        id: uid(),
        orderId: order.id,
        customer: order.customer,
        model: order.model,
        at: Date.now(),
        sideDiff: ev.sideDiff,
        baseDiff: ev.baseDiff,
        sideHigh: ev.sideHigh,
        baseHigh: ev.baseHigh,
        passed: ev.passed,
      };
      return {
        orders: s.orders.map((o) =>
          o.id === id
            ? { ...o, status: ev.passed ? "paired" : "failed", updatedAt: Date.now() }
            : o
        ),
        history: [rec, ...s.history],
      };
    });
  };

  const addOrder = (draft: {
    customer: string;
    model: string;
    wax: string;
    leftSide: number;
    leftBase: number;
    rightSide: number;
    rightBase: number;
    damageBoard: BoardSide;
    damageSpot: string;
    damageNote: string;
  }) => {
    const nextNum =
      orders.reduce((m, o) => {
        const n = parseInt(o.id.replace(/\D/g, ""), 10);
        return Number.isFinite(n) ? Math.max(m, n) : m;
      }, 100) + 1;
    const damages: Damage[] = draft.damageNote.trim()
      ? [
          {
            id: uid(),
            board: draft.damageBoard,
            spot: draft.damageSpot.trim() || "未标注位置",
            note: draft.damageNote.trim(),
          },
        ]
      : [];
    const order: Order = {
      id: `ORD-${nextNum}`,
      customer: draft.customer.trim(),
      model: draft.model.trim(),
      wax: draft.wax,
      leftSide: draft.leftSide,
      leftBase: draft.leftBase,
      rightSide: draft.rightSide,
      rightBase: draft.rightBase,
      damages,
      status: "pending",
      updatedAt: Date.now(),
    };
    setState((s) => ({ ...s, orders: [order, ...s.orders] }));
    setCreating(false);
    setSelectedId(order.id);
  };

  const addDamage = (orderId: string, board: BoardSide, spot: string, note: string) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) => {
        if (o.id !== orderId) return o;
        const status: PairStatus = o.status === "paired" ? "recheck" : o.status;
        return {
          ...o,
          damages: [...o.damages, { id: uid(), board, spot: spot.trim() || "未标注位置", note: note.trim() }],
          status,
          updatedAt: Date.now(),
        };
      }),
    }));
  };

  const removeDamage = (orderId: string, damageId: string) => {
    setState((s) => ({
      ...s,
      orders: s.orders.map((o) =>
        o.id === orderId
          ? { ...o, damages: o.damages.filter((d) => d.id !== damageId), updatedAt: Date.now() }
          : o
      ),
    }));
  };

  const removeOrder = (orderId: string) => {
    setState((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== orderId) }));
    setSelectedId(null);
  };

  /* ---- 渲染 ---- */

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62004 · 双板配对验收台 · 数据仅保存在本浏览器</p>
        <h1>双板配对验收台</h1>
        <span>
          前台拿回两块板后，在此登记工单并执行配对验收：两侧侧刃差超过 {SIDE_LIMIT}° 或底刃差超过{" "}
          {BASE_LIMIT}° 时不能配对交付，原值保留并标出偏高一侧。配对通过后改动任一刃角或新增损伤，这副板将回到待复核；每次验收的差值都会记入客户历史。
        </span>
      </section>

      <section className="metrics">
        <article>
          <small>待验收</small>
          <strong>{counts.pending}</strong>
        </article>
        <article>
          <small>已配对</small>
          <strong>{counts.paired}</strong>
        </article>
        <article>
          <small>待复核</small>
          <strong>{counts.recheck}</strong>
        </article>
        <article>
          <small>配对失败</small>
          <strong>{counts.failed}</strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="panel">
          <div className="heading">
            <div>
              <p>工单</p>
              <h2>验收队列</h2>
            </div>
          </div>
          <button
            className="primary block-btn"
            onClick={() => {
              setCreating(true);
              setSelectedId(null);
            }}
          >
            ＋ 新建工单
          </button>
          <div className="chips status-chips">
            <button
              className={statusFilter === "all" ? "chip active" : "chip"}
              onClick={() => setStatusFilter("all")}
            >
              全部 {orders.length}
            </button>
            {(Object.keys(STATUS_LABEL) as PairStatus[]).map((st) => (
              <button
                key={st}
                className={statusFilter === st ? "chip active" : "chip"}
                onClick={() => setStatusFilter(st)}
              >
                {STATUS_LABEL[st]} {counts[st]}
              </button>
            ))}
          </div>
          <div className="order-list">
            {filteredOrders.length === 0 && <p className="empty">该状态下暂无工单</p>}
            {filteredOrders.map((o) => (
              <button
                key={o.id}
                className={
                  showDetail && selected?.id === o.id ? "order-item active" : "order-item"
                }
                onClick={() => {
                  setSelectedId(o.id);
                  setCreating(false);
                }}
              >
                <span className="order-top">
                  <b>{o.id}</b>
                  <i className={`badge st-${o.status}`}>{STATUS_LABEL[o.status]}</i>
                </span>
                <span className="order-sub">
                  {o.customer} · {o.model}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {showDetail && selected ? (
          <OrderDetail
            order={selected}
            onPatch={patchOrder}
            onAccept={runAcceptance}
            onAddDamage={addDamage}
            onRemoveDamage={removeDamage}
            onRemoveOrder={removeOrder}
          />
        ) : (
          <OrderForm
            onSubmit={addOrder}
            onCancel={orders.length > 0 ? () => setCreating(false) : undefined}
          />
        )}
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>客户历史</p>
            <h2>验收差值记录</h2>
          </div>
        </div>
        <div className="chips status-chips">
          <button
            className={customerFilter === "all" ? "chip active" : "chip"}
            onClick={() => setCustomerFilter("all")}
          >
            全部客户 {history.length}
          </button>
          {customers.map((c) => (
            <button
              key={c}
              className={customerFilter === c ? "chip active" : "chip"}
              onClick={() => setCustomerFilter(c)}
            >
              {c} {history.filter((h) => h.customer === c).length}
            </button>
          ))}
        </div>
        <div className="records">
          {filteredHistory.length === 0 && <p className="empty">暂无验收记录</p>}
          {filteredHistory.map((h) => (
            <article key={h.id}>
              <b className={h.passed ? "stamp pass" : "stamp fail"}>
                {h.passed ? "通过" : "未过"}
              </b>
              <div>
                <h3>
                  {h.orderId} · {h.customer} · {h.model}
                </h3>
                <p>
                  {fmtTime(h.at)} 验收 — 侧刃差 {fmtDiff(h.sideDiff)}°（{sideText(h.sideHigh)}
                  ），底刃差 {fmtDiff(h.baseDiff)}°（{sideText(h.baseHigh)}）
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

/* ---------------- 新建工单 ---------------- */

interface Draft {
  customer: string;
  model: string;
  wax: string;
  leftSide: string;
  leftBase: string;
  rightSide: string;
  rightBase: string;
  damageBoard: BoardSide;
  damageSpot: string;
  damageNote: string;
}

const emptyDraft: Draft = {
  customer: "",
  model: "",
  wax: WAXES[0],
  leftSide: "88",
  leftBase: "1",
  rightSide: "88",
  rightBase: "1",
  damageBoard: "L",
  damageSpot: "",
  damageNote: "",
};

function OrderForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (d: {
    customer: string;
    model: string;
    wax: string;
    leftSide: number;
    leftBase: number;
    rightSide: number;
    rightBase: number;
    damageBoard: BoardSide;
    damageSpot: string;
    damageNote: string;
  }) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [error, setError] = useState("");

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const parse = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const submit = () => {
    const angles = [draft.leftSide, draft.leftBase, draft.rightSide, draft.rightBase].map(parse);
    if (!draft.customer.trim() || !draft.model.trim()) {
      setError("请填写客户与板型");
      return;
    }
    if (angles.some((a) => !Number.isFinite(a))) {
      setError("请完整填写左右板的侧刃角与底刃角");
      return;
    }
    setError("");
    onSubmit({
      customer: draft.customer,
      model: draft.model,
      wax: draft.wax,
      leftSide: angles[0],
      leftBase: angles[1],
      rightSide: angles[2],
      rightBase: angles[3],
      damageBoard: draft.damageBoard,
      damageSpot: draft.damageSpot,
      damageNote: draft.damageNote,
    });
    setDraft(emptyDraft);
  };

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>登记</p>
          <h2>新增工单</h2>
        </div>
        {onCancel && <button onClick={onCancel}>取消</button>}
      </div>
      <div className="field-grid">
        <label>
          <span>客户</span>
          <input
            placeholder="客户姓名"
            value={draft.customer}
            onChange={(e) => set({ customer: e.target.value })}
          />
        </label>
        <label>
          <span>板型</span>
          <input
            placeholder="如 竞速板 165"
            value={draft.model}
            onChange={(e) => set({ model: e.target.value })}
          />
        </label>
        <label>
          <span>蜡型</span>
          <select value={draft.wax} onChange={(e) => set({ wax: e.target.value })}>
            {WAXES.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <label>
          <span>左板侧刃角 °</span>
          <input
            type="number"
            step="0.1"
            value={draft.leftSide}
            onChange={(e) => set({ leftSide: e.target.value })}
          />
        </label>
        <label>
          <span>右板侧刃角 °</span>
          <input
            type="number"
            step="0.1"
            value={draft.rightSide}
            onChange={(e) => set({ rightSide: e.target.value })}
          />
        </label>
        <label>
          <span>左板底刃角 °</span>
          <input
            type="number"
            step="0.05"
            value={draft.leftBase}
            onChange={(e) => set({ leftBase: e.target.value })}
          />
        </label>
        <label>
          <span>右板底刃角 °</span>
          <input
            type="number"
            step="0.05"
            value={draft.rightBase}
            onChange={(e) => set({ rightBase: e.target.value })}
          />
        </label>
        <label>
          <span>损伤所在板（选填）</span>
          <select
            value={draft.damageBoard}
            onChange={(e) => set({ damageBoard: e.target.value as BoardSide })}
          >
            <option value="L">左板</option>
            <option value="R">右板</option>
          </select>
        </label>
        <label>
          <span>损伤位置（选填）</span>
          <input
            placeholder="如 板头 / 板腰 / 板尾"
            value={draft.damageSpot}
            onChange={(e) => set({ damageSpot: e.target.value })}
          />
        </label>
        <label>
          <span>底板损伤描述（选填）</span>
          <input
            placeholder="如 划痕 5cm，已补 P-Tex"
            value={draft.damageNote}
            onChange={(e) => set({ damageNote: e.target.value })}
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="actions">
        <button className="primary" onClick={submit}>
          保存工单
        </button>
      </div>
    </section>
  );
}

/* ---------------- 工单详情 / 验收 ---------------- */

function OrderDetail({
  order,
  onPatch,
  onAccept,
  onAddDamage,
  onRemoveDamage,
  onRemoveOrder,
}: {
  order: Order;
  onPatch: (id: string, patch: Partial<Order>, touchesPairing?: boolean) => void;
  onAccept: (id: string) => void;
  onAddDamage: (orderId: string, board: BoardSide, spot: string, note: string) => void;
  onRemoveDamage: (orderId: string, damageId: string) => void;
  onRemoveOrder: (orderId: string) => void;
}) {
  const ev = evaluate(order);
  const [dmgBoard, setDmgBoard] = useState<BoardSide>("L");
  const [dmgSpot, setDmgSpot] = useState("");
  const [dmgNote, setDmgNote] = useState("");

  const angleInput = (key: "leftSide" | "leftBase" | "rightSide" | "rightBase", step: string) => (
    <input
      type="number"
      step={step}
      value={Number.isFinite(order[key]) ? order[key] : ""}
      onChange={(e) => onPatch(order.id, { [key]: e.target.valueAsNumber }, true)}
    />
  );

  const failReasons: string[] = [];
  if (ev.valid && !ev.sideOk)
    failReasons.push(
      `侧刃差 ${fmtDiff(ev.sideDiff)}°（${sideText(ev.sideHigh)}），超过 ${SIDE_LIMIT}° 上限`
    );
  if (ev.valid && !ev.baseOk)
    failReasons.push(
      `底刃差 ${fmtDiff(ev.baseDiff)}°（${sideText(ev.baseHigh)}），超过 ${BASE_LIMIT}° 上限`
    );

  const acceptLabel =
    order.status === "recheck"
      ? "复核验收"
      : order.status === "failed"
        ? "重新验收"
        : "执行配对验收";

  const submitDamage = () => {
    if (!dmgNote.trim()) return;
    onAddDamage(order.id, dmgBoard, dmgSpot, dmgNote);
    setDmgSpot("");
    setDmgNote("");
  };

  const damageCol = (board: BoardSide, title: string) => {
    const list = order.damages.filter((d) => d.board === board);
    return (
      <div className="damage-col">
        <h4>{title}</h4>
        {list.length === 0 && <p className="empty">无登记损伤</p>}
        {list.map((d) => (
          <div key={d.id} className="damage-item">
            <span>
              <b>{d.spot}</b> · {d.note}
            </span>
            <button title="删除该损伤记录" onClick={() => onRemoveDamage(order.id, d.id)}>
              删除
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <section className="panel detail-panel">
      <div className="heading">
        <div>
          <p>
            {order.id} · 更新于 {fmtTime(order.updatedAt)}
          </p>
          <h2>
            {order.customer} · {order.model}
          </h2>
        </div>
        <span className={`badge st-${order.status}`}>{STATUS_LABEL[order.status]}</span>
      </div>

      {order.status === "failed" && (
        <div className="banner fail">
          <b>不能配对交付：</b>
          {failReasons.length > 0 ? failReasons.join("；") : "请补全刃角后重新验收"}
          。原值已保留，请调校后重新验收。
        </div>
      )}
      {order.status === "recheck" && (
        <div className="banner warn">
          配对后刃角有改动或新增了损伤，这副板已回到待复核，需复核验收通过后才能交付。
        </div>
      )}
      {order.status === "paired" && (
        <div className="banner ok">
          已配对，可作为一副交付。改动任一刃角或新增损伤将自动回到待复核。
        </div>
      )}

      <div className="field-grid">
        <label>
          <span>客户</span>
          <input
            value={order.customer}
            onChange={(e) => onPatch(order.id, { customer: e.target.value })}
          />
        </label>
        <label>
          <span>板型</span>
          <input
            value={order.model}
            onChange={(e) => onPatch(order.id, { model: e.target.value })}
          />
        </label>
        <label>
          <span>蜡型</span>
          <select
            value={order.wax}
            onChange={(e) => onPatch(order.id, { wax: e.target.value })}
          >
            {WAXES.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
      </div>

      <h3 className="section-title">刃角对比（差值实时计算）</h3>
      <table className="diff-table">
        <thead>
          <tr>
            <th>项目</th>
            <th>左板 °</th>
            <th>右板 °</th>
            <th>差值</th>
            <th>判定</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>侧刃角</td>
            <td>{angleInput("leftSide", "0.1")}</td>
            <td>{angleInput("rightSide", "0.1")}</td>
            <td className={ev.valid ? (ev.sideOk ? "diff ok" : "diff bad") : "diff"}>
              {fmtDiff(ev.sideDiff)}°{ev.valid && ev.sideHigh ? ` · ${sideText(ev.sideHigh)}` : ""}
            </td>
            <td className={ev.valid ? (ev.sideOk ? "judge ok" : "judge bad") : "judge"}>
              {ev.valid ? (ev.sideOk ? `≤ ${SIDE_LIMIT}° 通过` : "超差，不能配对") : "待填写"}
            </td>
          </tr>
          <tr>
            <td>底刃角</td>
            <td>{angleInput("leftBase", "0.05")}</td>
            <td>{angleInput("rightBase", "0.05")}</td>
            <td className={ev.valid ? (ev.baseOk ? "diff ok" : "diff bad") : "diff"}>
              {fmtDiff(ev.baseDiff)}°{ev.valid && ev.baseHigh ? ` · ${sideText(ev.baseHigh)}` : ""}
            </td>
            <td className={ev.valid ? (ev.baseOk ? "judge ok" : "judge bad") : "judge"}>
              {ev.valid ? (ev.baseOk ? `≤ ${BASE_LIMIT}° 通过` : "超差，不能配对") : "待填写"}
            </td>
          </tr>
        </tbody>
      </table>

      <h3 className="section-title">底板损伤</h3>
      <div className="damage-cols">
        {damageCol("L", "左板")}
        {damageCol("R", "右板")}
      </div>
      <div className="damage-form">
        <select value={dmgBoard} onChange={(e) => setDmgBoard(e.target.value as BoardSide)}>
          <option value="L">左板</option>
          <option value="R">右板</option>
        </select>
        <input
          placeholder="位置，如 板腰"
          value={dmgSpot}
          onChange={(e) => setDmgSpot(e.target.value)}
        />
        <input
          placeholder="损伤描述，如 划痕 4cm"
          value={dmgNote}
          onChange={(e) => setDmgNote(e.target.value)}
        />
        <button onClick={submitDamage} disabled={!dmgNote.trim()}>
          添加损伤
        </button>
      </div>

      <div className="actions">
        <button
          className="primary"
          disabled={!ev.valid || order.status === "paired"}
          title={
            order.status === "paired"
              ? "已配对；改动刃角或新增损伤后可复核"
              : !ev.valid
                ? "请完整填写左右板刃角"
                : ""
          }
          onClick={() => onAccept(order.id)}
        >
          {acceptLabel}
        </button>
        <span className="rule-hint">
          规则：侧刃差 ≤ {SIDE_LIMIT}°，底刃差 ≤ {BASE_LIMIT}°
        </span>
        <button
          className="danger"
          onClick={() => {
            if (window.confirm(`确定删除工单 ${order.id}？验收历史会保留。`)) {
              onRemoveOrder(order.id);
            }
          }}
        >
          删除工单
        </button>
      </div>
    </section>
  );
}

export default App;
