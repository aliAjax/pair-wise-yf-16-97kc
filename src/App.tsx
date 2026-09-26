import { useMemo, useState } from "react";
import "./styles.css";
import type {
  Acceptance,
  Board,
  NewOrderInput,
  Order,
  OrderStatus,
  Side,
} from "./types";
import {
  BOARD_TYPES,
  STATUS_META,
  isDrifted,
  nextOrderId,
  runAcceptance,
  uid,
} from "./types";
import { clearOrders, loadOrders, saveOrders } from "./storage";
import { seedOrders } from "./seed";
import OrderCard from "./components/OrderCard";
import OrderForm from "./components/OrderForm";
import CustomerHistory from "./components/CustomerHistory";

type StatusFilter = OrderStatus | "all";

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "pending", label: "待验收" },
  { key: "review", label: "待复核" },
  { key: "passed", label: "已配对" },
  { key: "failed", label: "不能配对" },
];

export default function App() {
  const [orders, setOrders] = useState<Order[]>(() => loadOrders() ?? seedOrders());
  const [boardFilter, setBoardFilter] = useState<string>("全部板型");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [keyword, setKeyword] = useState("");

  const commit = (updater: (prev: Order[]) => Order[]) => {
    setOrders((prev) => {
      const next = updater(prev);
      saveOrders(next);
      return next;
    });
  };

  // 对已通过验收的工单：侧刃 / 底刃被改动，或底板损伤增删 → 回到待复核。
  // 不通过 / 待复核 / 待验收状态保持不变（原值保留，不因编辑而洗白）。
  const withDrift = (next: Order): Order =>
    next.status === "passed" && isDrifted(next) ? { ...next, status: "review" } : next;

  const mutateBoard = (
    id: string,
    side: Side,
    fn: (board: Board) => Board
  ) => {
    commit((prev) =>
      prev.map((o) => {
        if (o.id !== id) return o;
        const key = side === "L" ? "left" : "right";
        const next: Order = { ...o, [key]: fn(o[key]) };
        return withDrift(next);
      })
    );
  };

  const handleAngle = (
    id: string,
    side: Side,
    field: "sideEdge" | "baseEdge",
    value: number
  ) => {
    if (Number.isNaN(value)) return;
    mutateBoard(id, side, (b) => ({ ...b, [field]: value }));
  };

  const handleWax = (id: string, side: Side, wax: string) =>
    mutateBoard(id, side, (b) => ({ ...b, wax }));

  const handleAddDamage = (
    id: string,
    side: Side,
    damage: { position: string; desc: string; lengthCm?: number; repaired?: boolean }
  ) =>
    mutateBoard(id, side, (b) => ({
      ...b,
      damages: [...b.damages, { ...damage, id: uid() }],
    }));

  const handleToggleRepair = (id: string, side: Side, damageId: string) =>
    mutateBoard(id, side, (b) => ({
      ...b,
      damages: b.damages.map((d) =>
        d.id === damageId ? { ...d, repaired: !d.repaired } : d
      ),
    }));

  const handleRemoveDamage = (id: string, side: Side, damageId: string) =>
    mutateBoard(id, side, (b) => ({
      ...b,
      damages: b.damages.filter((d) => d.id !== damageId),
    }));

  const handleVerify = (id: string) =>
    commit((prev) => prev.map((o) => (o.id === id ? runAcceptance(o) : o)));

  const handleDelete = (id: string) =>
    commit((prev) => prev.filter((o) => o.id !== id));

  const handleCreate = (input: NewOrderInput) => {
    commit((prev) => [
      {
        ...input,
        id: nextOrderId(prev),
        createdAt: Date.now(),
        status: "pending",
        history: [] as Acceptance[],
        snapshot: null,
      },
      ...prev,
    ]);
  };

  const handleResetData = () => {
    if (window.confirm("确定清空浏览器中的全部工单与验收历史？此操作不可恢复。")) {
      clearOrders();
      setOrders([]);
      setKeyword("");
    }
  };

  const filtered = useMemo(() => {
    const k = keyword.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (boardFilter !== "全部板型" && o.boardType !== boardFilter) return false;
      if (
        k &&
        !o.customer.toLowerCase().includes(k) &&
        !o.id.toLowerCase().includes(k) &&
        !o.boardModel.toLowerCase().includes(k)
      ) {
        return false;
      }
      return true;
    });
  }, [orders, statusFilter, boardFilter, keyword]);

  const counts = useMemo(() => {
    const c: Record<OrderStatus, number> = {
      pending: 0,
      review: 0,
      passed: 0,
      failed: 0,
    };
    for (const o of orders) c[o.status] += 1;
    return c;
  }, [orders]);

  const totalAcceptances = orders.reduce((n, o) => n + o.history.length, 0);

  return (
    <main className="app">
      <section className="hero">
        <p>双板配对验收台 · 数据仅保存在本浏览器（localStorage）</p>
        <h1>两块板，能不能作一副交付？</h1>
        <span>
          每张工单登记客户、板型与左右板的侧刃角、底刃角、蜡型、底板损伤。两侧侧刃差超过
          <b> 0.50° </b>
          或底刃差超过
          <b> 0.25° </b>
          即判为不能配对，原始测量值保留并指明差在哪一侧。配对通过后任一侧刃角被改动或新增底板损伤，这副板自动回到待复核；每次验收差值都永久记入客户历史。
        </span>
      </section>

      <section className="metrics">
        <article className="metric-pending">
          <small>待验收</small>
          <strong>{counts.pending}</strong>
        </article>
        <article className="metric-review">
          <small>待复核</small>
          <strong>{counts.review}</strong>
        </article>
        <article className="metric-passed">
          <small>已配对可交付</small>
          <strong>{counts.passed}</strong>
        </article>
        <article className="metric-failed">
          <small>不能配对 / 验收次数</small>
          <strong>
            {counts.failed}
            <em> / {totalAcceptances}</em>
          </strong>
        </article>
      </section>

      <section className="workspace">
        <aside className="panel side-panel">
          <h2>登记新工单</h2>
          <OrderForm onCreate={handleCreate} />
        </aside>

        <section className="panel list-panel">
          <div className="heading">
            <div>
              <p>验收工位</p>
              <h2>工单列表（{filtered.length}）</h2>
            </div>
            <button className="ghost danger-ghost" onClick={handleResetData}>
              清空浏览器数据
            </button>
          </div>

          <div className="filters">
            <div className="filter-row">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={statusFilter === f.key ? "active" : ""}
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}
                  {f.key !== "all" && (
                    <i className="filter-count">{counts[f.key as OrderStatus]}</i>
                  )}
                </button>
              ))}
            </div>
            <div className="filter-row">
              <button
                className={boardFilter === "全部板型" ? "active" : ""}
                onClick={() => setBoardFilter("全部板型")}
              >
                全部板型
              </button>
              {BOARD_TYPES.map((t) => (
                <button
                  key={t}
                  className={boardFilter === t ? "active" : ""}
                  onClick={() => setBoardFilter(t)}
                >
                  {t}
                </button>
              ))}
            </div>
            <input
              className="filter-search"
              placeholder="搜索客户 / 工单号 / 品牌型号"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="orders">
            {filtered.length === 0 ? (
              <div className="orders-empty">
                没有符合当前筛选的工单。左侧可登记新工单，或调整筛选条件。
              </div>
            ) : (
              filtered.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  onAngle={handleAngle}
                  onWax={handleWax}
                  onAddDamage={handleAddDamage}
                  onToggleRepair={handleToggleRepair}
                  onRemoveDamage={handleRemoveDamage}
                  onVerify={handleVerify}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>

          <div className="status-legend">
            {(Object.keys(STATUS_META) as OrderStatus[]).map((s) => (
              <span key={s} className={`legend-item ${STATUS_META[s].variant}`}>
                <i />
                {STATUS_META[s].label}：{STATUS_META[s].hint}
              </span>
            ))}
          </div>
        </section>
      </section>

      <CustomerHistory orders={orders} />
    </main>
  );
}
