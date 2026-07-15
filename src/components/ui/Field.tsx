import { useId } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx";

interface FieldBaseProps {
  /** Label pequeno uppercase acima do controle. */
  label: string;
  /** Mensagem de erro inline (pinta a borda de coral). */
  error?: string;
  /** Dica discreta abaixo do controle (ignorada quando há erro). */
  hint?: string;
  className?: string;
}

export type FieldProps =
  | (FieldBaseProps & { as?: "input" } & Omit<InputHTMLAttributes<HTMLInputElement>, "className">)
  | (FieldBaseProps & { as: "select" } & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className">)
  | (FieldBaseProps & { as: "textarea" } & Omit<
      TextareaHTMLAttributes<HTMLTextAreaElement>,
      "className"
    >);

/**
 * Campo de formulário completo: label + input/select/textarea estilizados
 * + erro inline. Para <select>, passe as <option> como children.
 */
export default function Field(props: FieldProps) {
  const { label, error, hint, className, ...rest } = props;
  const autoId = useId();
  const id = rest.id ?? autoId;
  const messageId = error ? `${id}-erro` : hint ? `${id}-dica` : undefined;

  const controlProps = {
    id,
    className: "field-control",
    "aria-invalid": error ? true : undefined,
    "aria-describedby": messageId,
  } as const;

  let control: ReactNode;
  if (rest.as === "select") {
    const { as: _as, ...selectRest } = rest;
    control = <select {...selectRest} {...controlProps} />;
  } else if (rest.as === "textarea") {
    const { as: _as, ...textareaRest } = rest;
    control = <textarea {...textareaRest} {...controlProps} />;
  } else {
    const { as: _as, ...inputRest } = rest;
    control = <input {...inputRest} {...controlProps} />;
  }

  return (
    <div className={cx("field", error && "field--error", className)}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {control}
      {error ? (
        <p className="field-error" id={messageId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint" id={messageId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
