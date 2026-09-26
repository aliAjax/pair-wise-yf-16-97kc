import { useMemo, useState } from "react";
import type { Acceptance, Order } from "../types";
import { fmtAngle, fmtTime } from "../types";

interface CustomerHistoryProps {
  orders: Order[];
}

interface Entry extends Acceptance {
  orderId: string;
  customer: string;
  boardType: string;
  boardModel: string;
}

export default function CustomerHistory({ orders }: CustomerHistoryProps) {
  const [keyword, setKeyword] = useState("");

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const o of orders) {
      for (const h of o.history) {
        list.push({
          ...h,
          orderId: o.id,
          customer: o.customer,
          boardType: o.boardType,
          boardModel: o.boardModel,
        });
      }
    }
    const k = keyword.trim();
    return list
      .filter((e) => !k || e.customer.includes(k) || e.orderId.includes(k.toUpperCase()))
      .sort((a, b) => b.at - a.at);
  }, [orders, keyword]);

  const customers = useMemo(
    () => Array.from(new Set(orders.map((o) => o.customer))).sort(),
    [orders]
  );

  return (
    <section className="panel history-panel">
      <div className="heading">
        <div>
          <p>客户历史</p>
          <h2>每次验收差值留痕</h2>
        </div>
        <input
          className="history-search"
          placeholder="搜客户 / 工单号"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
      </div>

      {customers.length > 0 && (
        <div className="customer-chips">
          {customers.map((c) => (
            <button
              key={c}
              className={keyword === c ? "active" : ""}
              onClick={() => setKeyword((k) => (k === c ? "" : c))}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="history-empty">
          {orders.length === 0
            ? "暂无工单，先在左侧登记一副板。"
            : "还没有验收记录；执行配对验收后，通过与不通过的差值都会保留在这里。"}
        </div>
      ) : (
        <ul className="history-list">
          {entries.map((e) => (
            <li key={e.id} className={e.passed ? "pass" : "fail"}>
              <div className="history-head">
                <span className={`mini-badge ${e.passed ? "passed" : "failed"}`}>
                  {e.passed ? "通过" : "不通过"}
                </span>
                <b>{e.customer}</b>
                <span className="history-meta">
                  {e.orderId} · {e.boardType}
                  {e.boardModel ? ` · ${e.boardModel}` : ""}
                </span>
                <time>{fmtTime(e.at)}</time>
              </div>
              <div className="history-diffs">
                <span>
                  侧刃 左 {fmtAngle(e.sideL)}° / 右 {fmtAngle(e.sideR)}° → 差{" "}
                  <b>{fmtAngle(e.sideDiff)}°</b>
                </span>
                <span>
                  底刃 左 {fmtAngle(e.baseL)}° / 右 {fmtAngle(e.baseR)}° → 差{" "}
                  <b>{fmtAngle(e.baseDiff)}°</b>
                </span>
              </div>
              {!e.passed && e.failures.length > 0 && (
                <ul className="history-failures">
                  {e.failures.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
