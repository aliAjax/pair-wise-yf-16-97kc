interface NumberFieldProps {
  label: string;
  value: number;
  step: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (v: number) => void;
  invalid?: boolean;
}

export default function NumberField({
  label,
  value,
  step,
  min,
  max,
  unit,
  onChange,
  invalid,
}: NumberFieldProps) {
  return (
    <label className={invalid ? "num-field invalid" : "num-field"}>
      <span>{label}</span>
      <span className="num-input">
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          value={Number.isNaN(value) ? "" : value}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(Number.isNaN(v) ? NaN : Math.round(v / step) * step);
          }}
        />
        {unit ? <em>{unit}</em> : null}
      </span>
    </label>
  );
}
