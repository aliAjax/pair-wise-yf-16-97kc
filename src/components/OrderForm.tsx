import { useState } from "react";
import type { NewOrderInput } from "../types";
import { BOARD_TYPES, WAX_TYPES, evaluate } from "../types";
import NumberField from "./NumberField";

interface OrderFormProps {
  onCreate: (input: NewOrderInput) => void;
}

interface SideDraft {
  sideEdge: number;
  baseEdge: number;
  wax: string;
}

const newSide = (): SideDraft => ({ sideEdge: 88, baseEdge: 0.5, wax: "全温蜡" });

export default function OrderForm({ onCreate }: OrderFormProps) {
  const [customer, setCustomer] = useState("");
  const [boardType, setBoardType] = useState<string>(BOARD_TYPES[0]);
  const [boardModel, setBoardModel] = useState("");
  const [left, setLeft] = useState<SideDraft>(newSide);
  const [right, setRight] = useState<SideDraft>(newSide);
  const [error, setError] = useState("");

  const preview = evaluate({
    left: { ...left, damages: [] },
    right: { ...right, damages: [] },
  });

  const setSide = (side: "L" | "R", patch: Partial<SideDraft>) => {
    const apply = (s: SideDraft) => ({ ...s, ...patch });
    if (side === "L") setLeft(apply);
    else setRight(apply);
  };

  const reset = () => {
    setCustomer("");
    setBoardType(BOARD_TYPES[0]);
    setBoardModel("");
    setLeft(newSide());
    setRight(newSide());
  };

  const submit = () => {
    if (!customer.trim()) {
      setError("请先登记客户姓名");
      return;
    }
    onCreate({
      customer: customer.trim(),
      boardType,
      boardModel: boardModel.trim(),
      left: { ...left, damages: [] },
      right: { ...right, damages: [] },
    });
    reset();
  };

  const sideFields = (side: "L" | "R", draft: SideDraft) => (
    <fieldset className="form-side">
      <legend>{side === "L" ? "左板" : "右板"}</legend>
      <div className="angle-row">
        <NumberField
          label="侧刃角"
          value={draft.sideEdge}
          step={0.25}
          min={80}
          max={90}
          unit="°"
          onChange={(v) => setSide(side, { sideEdge: v })}
        />
        <NumberField
          label="底刃角"
          value={draft.baseEdge}
          step={0.25}
          min={0}
          max={3}
          unit="°"
          onChange={(v) => setSide(side, { baseEdge: v })}
        />
      </div>
      <label className="wax-field">
        <span>蜡型</span>
        <select value={draft.wax} onChange={(e) => setSide(side, { wax: e.target.value })}>
          {WAX_TYPES.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  );

  return (
    <div className="order-form">
      <div className="field-grid">
        <label>
          <span>客户 *</span>
          <input
            placeholder="客户姓名 / 联系方式"
            value={customer}
            onChange={(e) => {
              setCustomer(e.target.value);
              setError("");
            }}
          />
        </label>
        <label>
          <span>品牌型号</span>
          <input
            placeholder="如 Burton Custom 156"
            value={boardModel}
            onChange={(e) => setBoardModel(e.target.value)}
          />
        </label>
        <label>
          <span>板型</span>
          <select value={boardType} onChange={(e) => setBoardType(e.target.value)}>
            {BOARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="form-sides">
        {sideFields("L", left)}
        {sideFields("R", right)}
      </div>

      <div className={`form-preview ${preview.passed ? "ok" : "bad"}`}>
        登记预览：侧刃差 <b>{preview.sideDiff.toFixed(2)}°</b>（限值 0.50°） · 底刃差{" "}
        <b>{preview.baseDiff.toFixed(2)}°</b>（限值 0.25°）
        {preview.passed ? "，当前可通过" : "，当前超限位，登记后仍可在工单内调整"}
      </div>

      {error && <p className="form-error">{error}</p>}
      <div className="form-actions">
        <button className="ghost" onClick={reset}>
          清空
        </button>
        <button className="primary" onClick={submit}>
          登记工单
        </button>
      </div>
    </div>
  );
}
