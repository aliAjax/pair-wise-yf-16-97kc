import { useState } from "react";
import type { Board, Side } from "../types";
import { POSITIONS, WAX_TYPES, fmtAngle } from "../types";
import NumberField from "./NumberField";

interface BoardEditorProps {
  side: Side;
  board: Board;
  onAngle: (field: "sideEdge" | "baseEdge", value: number) => void;
  onWax: (wax: string) => void;
  onAddDamage: (damage: Omit<Board["damages"][number], "id">) => void;
  onToggleRepair: (id: string) => void;
  onRemoveDamage: (id: string) => void;
}

const SIDE_LABEL: Record<Side, string> = { L: "左板", R: "右板" };

export default function BoardEditor({
  side,
  board,
  onAngle,
  onWax,
  onAddDamage,
  onToggleRepair,
  onRemoveDamage,
}: BoardEditorProps) {
  const [pos, setPos] = useState<string>(POSITIONS[1]);
  const [desc, setDesc] = useState("");
  const [len, setLen] = useState("");

  const submitDamage = () => {
    if (!desc.trim()) return;
    const lengthCm = parseFloat(len);
    onAddDamage({
      position: pos,
      desc: desc.trim(),
      ...(Number.isNaN(lengthCm) ? {} : { lengthCm }),
    });
    setDesc("");
    setLen("");
  };

  return (
    <div className={`board-editor side-${side === "L" ? "l" : "r"}`}>
      <header>
        <span className="side-tag">{SIDE_LABEL[side]}</span>
        <span className="side-summary">
          侧刃 {fmtAngle(board.sideEdge)}° · 底刃 {fmtAngle(board.baseEdge)}°
        </span>
      </header>

      <div className="angle-row">
        <NumberField
          label="侧刃角"
          value={board.sideEdge}
          step={0.25}
          min={80}
          max={90}
          unit="°"
          onChange={(v) => onAngle("sideEdge", v)}
        />
        <NumberField
          label="底刃角"
          value={board.baseEdge}
          step={0.25}
          min={0}
          max={3}
          unit="°"
          onChange={(v) => onAngle("baseEdge", v)}
        />
      </div>

      <label className="wax-field">
        <span>蜡型</span>
        <select value={board.wax} onChange={(e) => onWax(e.target.value)}>
          {WAX_TYPES.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>

      <div className="damage-block">
        <p>底板损伤（{board.damages.length}）</p>
        {board.damages.length === 0 ? (
          <div className="damage-empty">暂无登记</div>
        ) : (
          <ul className="damage-list">
            {board.damages.map((d) => (
              <li key={d.id} className={d.repaired ? "repaired" : ""}>
                <span className="pos-tag">{d.position}</span>
                <span className="damage-text">
                  {d.desc}
                  {typeof d.lengthCm === "number" ? ` · ${d.lengthCm}cm` : ""}
                </span>
                <label className="repair-check">
                  <input
                    type="checkbox"
                    checked={!!d.repaired}
                    onChange={() => onToggleRepair(d.id)}
                  />
                  已修补
                </label>
                <button
                  className="icon-btn"
                  title="删除该损伤"
                  onClick={() => onRemoveDamage(d.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="damage-add">
          <select value={pos} onChange={(e) => setPos(e.target.value)}>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            placeholder="损伤描述，如划痕、烧板"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitDamage();
            }}
          />
          <input
            className="len-input"
            placeholder="长度cm"
            value={len}
            onChange={(e) => setLen(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitDamage();
            }}
          />
          <button onClick={submitDamage} disabled={!desc.trim()}>
            标记损伤
          </button>
        </div>
      </div>
    </div>
  );
}
