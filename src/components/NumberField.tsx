import { useEffect, useState, type InputHTMLAttributes, type Ref } from "react";

export default function NumberField({
  value,
  onValue,
  ref,
  ...rest
}: {
  value: number;
  onValue: (n: number) => void;
  ref?: Ref<HTMLInputElement>;
} & Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "ref"
>) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(String(value));
  }, [value]);
  return (
    <input
      {...rest}
      ref={ref}
      type="number"
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onValue(e.target.value === "" ? 0 : Number(e.target.value));
      }}
      onBlur={(e) => {
        if (text === "" || Number.isNaN(Number(text))) setText(String(value));
        rest.onBlur?.(e);
      }}
    />
  );
}
