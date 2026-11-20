import type { ReactNode } from "react";

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ErrorNote({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="error" role="alert">
      {message}
    </p>
  );
}

export function Panel({
  title,
  hint,
  onBack,
  children,
}: {
  title: string;
  hint?: string;
  onBack?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <header className="panel-head">
        {onBack ? (
          <button type="button" className="back" onClick={onBack}>
            Back
          </button>
        ) : null}
        <div>
          <h1>{title}</h1>
          {hint ? <p className="meta">{hint}</p> : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export function FormActions({
  submitLabel,
  pending,
  onCancel,
}: {
  submitLabel: string;
  pending?: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="actions">
      <button type="submit" className="btn primary" disabled={pending}>
        {pending ? "Saving…" : submitLabel}
      </button>
      {onCancel ? (
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      ) : null}
    </div>
  );
}
