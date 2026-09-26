import type { Order, Side } from "../types";
import {
  BASE_TOL,
  SIDE_TOL,
  STATUS_META,
  evaluate,
  fmtAngle,
  fmtTime,
} from "../types";
import BoardEditor from "./BoardEditor";

interface OrderCardProps {
  order: Order;
  onAngle: (id: string, side: Side, field: "sideEdge" | "baseEdge", value: number) => void;
  onWax: (id: string, side: Side, wax: string) => void;
  onAddDamage: (
    id: string,
    side: Side,
    damage: { position: string; desc: string; lengthCm?: number; repaired?: boolean }
  ) => void;
  onToggleRepair: (id: string, side: Side, damageId: string) => void;
  onRemoveDamage: (id: string, side: Side, damageId: string) => void;
  onVerify: (id: string) => void;
  onDelete: (id: string) => void;
}

function DiffRow({
  name,
  diff,
  tol,
  left,
  right,
}: {
  name: string;
  diff: number;
  tol: number;
  left: number;
  right: number;
}) {
  const ok = diff <= tol;
  return (
    <div className={`diff-row ${ok ? "ok" : "bad"}`}>
      <b>{name}差</b>
      <span className="diff-value">{fmtAngle(diff)}°</span>
      <span className="diff-limit">限值 {fmtAngle(tol)}°</span>
      <span className="diff-detail">
        左 {fmtAngle(left)}° / 右 {fmtAngle(right)}°
      </span>
      <span className="diff-state">{ok ? "合格" : "超限"}</span>
    </div>
  );
}

export default function OrderCard({
  order,
  onAngle,
  onWax,
  onAddDamage,
  onToggleRepair,
  onRemoveDamage,
  onVerify,
  onDelete,
}: OrderCardProps) {
  const v = evaluate(order);
  const meta = STATUS_META[order.status];
  const last = order.history[order.history.length - 1];

  const boardProps = (side: Side) => {
    const board = side === "L" ? order.left : order.right;
    return {
      side,
      board,
      onAngle: (field: "sideEdge" | "baseEdge", value: number) =>
        onAngle(order.id, side, field, value),
      onWax: (wax: string) => onWax(order.id, side, wax),
      onAddDamage: (d: { position: string; desc: string; lengthCm?: number }) =>
        onAddDamage(order.id, side, d),
      onToggleRepair: (damageId: string) =>
        onToggleRepair(order.id, side, damageId),
      onRemoveDamage: (damageId: string) =>
        onRemoveDamage(order.id, side, damageId),
    };
  };

  return (
    <article className={`order-card status-${meta.variant}`}>
      <header className="order-head">
        <div className="order-title">
          <h3>{order.id}</h3>
          <span className="customer">
            {order.customer} · {order.boardType} · {order.boardModel || "未填型号"}
          </span>
          <small className="created">登记于 {fmtTime(order.createdAt)}</small>
        </div>
        <div className="order-actions-top">
          <span className={`badge ${meta.variant}`}>{meta.label}</span>
          <button className="icon-btn danger" title="删除工单" onClick={() => onDelete(order.id)}>
            删除
          </button>
        </div>
      </header>

      {order.status === "review" && (
        <div className="banner review">
          <b>待复核：</b>
          验收通过后刃角被改动或底板损伤有增删，请确认当前测量值后重新执行配对验收。
        </div>
      )}
      {order.status === "failed" && last && (
        <div className="banner failed">
          <b>不能配对 · 最近一次验收（{fmtTime(last.at)}）差值超限：</b>
          <ul>
            {last.failures.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <span>原测量值已保留，请以更磨/补刃方式处理后再验收。</span>
        </div>
      )}
      {order.status === "passed" && (
        <div className="banner passed">
          <b>配对验收通过</b>
          {last ? `（${fmtTime(last.at)}）` : ""}，两板差值在限值内，可作为一副交付。
        </div>
      )}
      {order.status === "pending" && (
        <div className="banner pending">工单已登记，核对左右板数据后执行配对验收。</div>
      )}

      <div className="diff-strip">
        <DiffRow name="侧刃" diff={v.sideDiff} tol={SIDE_TOL} left={order.left.sideEdge} right={order.right.sideEdge} />
        <DiffRow name="底刃" diff={v.baseDiff} tol={BASE_TOL} left={order.left.baseEdge} right={order.right.baseEdge} />
      </div>

      <div className="boards-grid">
        <BoardEditor {...boardProps("L")} />
        <BoardEditor {...boardProps("R")} />
      </div>

      <footer className="order-foot">
        <span className="history-hint">
          验收记录 {order.history.length} 次
          {last
            ? ` · 最近：${last.passed ? "通过" : "不通过"}（侧刃差 ${fmtAngle(last.sideDiff)}° / 底刃差 ${fmtAngle(last.baseDiff)}°）`
            : ""}
        </span>
        <button className="primary" onClick={() => onVerify(order.id)}>
          {order.status === "review" ? "重新配对验收" : "执行配对验收"}
        </button>
        {v.failures.length > 0 && (
          <span className="foot-warn">当前差值超限，验收将判为不通过并记入历史，原值保留</span>
        )}
      </footer>
    </article>
  );
}
