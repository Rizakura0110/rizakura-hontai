import { useEffect } from "react";

export type ToastState = {
  readonly id: number;
  readonly message: string;
  readonly tone?: "success" | "error" | "info";
  readonly action?:
    | { readonly label: string; readonly onClick: () => void | Promise<void> }
    | { readonly label: string; readonly href: string };
};

type ToastProps = {
  readonly toast: ToastState | null;
  readonly onDismiss: () => void;
};

export function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (toast === null) return;
    const timeout = window.setTimeout(onDismiss, toast.tone === "error" ? 8_000 : 6_000);
    return () => window.clearTimeout(timeout);
  }, [toast, onDismiss]);

  if (toast === null) return null;

  const action = toast.action;

  const toneClass =
    toast.tone === "error"
      ? "border-red-200 bg-red-50 text-red-900"
      : toast.tone === "info"
        ? "border-blue-200 bg-blue-50 text-blue-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-900";

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={`fixed bottom-24 left-1/2 z-50 flex w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg md:bottom-6 ${toneClass}`}
      role="status"
    >
      <span className="min-w-0 flex-1">{toast.message}</span>
      {action === undefined ? null : "href" in action ? (
        <a
          className="inline-flex min-h-11 shrink-0 items-center rounded-md px-2 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-current"
          href={action.href}
          rel="noopener noreferrer"
          target="_blank"
        >
          {action.label}
        </a>
      ) : (
        <button
          className="min-h-11 shrink-0 rounded-md px-2 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-current"
          onClick={() => void action.onClick()}
          type="button"
        >
          {action.label}
        </button>
      )}
      <button
        aria-label="通知を閉じる"
        className="grid size-11 shrink-0 place-items-center rounded-md text-lg hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-current"
        onClick={onDismiss}
        type="button"
      >
        ×
      </button>
    </div>
  );
}
