import { type ReactNode, useEffect, useId, useRef } from "react";

type ModalProps = {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly onClose: () => void;
};

export function Modal({ open, title, description, children, onClose }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open) {
      previousFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const focusTarget =
        dialog.querySelector<HTMLElement>("[data-autofocus]") ??
        dialog.querySelector<HTMLElement>("input, button, select");
      focusTarget?.setAttribute("autofocus", "");
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") dialog.showModal();
        else dialog.setAttribute("open", "");
      }
      focusTarget?.focus({ preventScroll: true });
      const focusFrame = window.requestAnimationFrame(() => {
        focusTarget?.focus({ preventScroll: true });
      });
      return () => {
        window.cancelAnimationFrame(focusFrame);
        focusTarget?.removeAttribute("autofocus");
      };
    }

    if (dialog.open && typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    previousFocusRef.current?.focus();
  }, [open]);

  return (
    <dialog
      aria-describedby={description === undefined ? undefined : descriptionId}
      aria-labelledby={titleId}
      className="modal m-auto max-h-[calc(100dvh-2rem)] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-slate-200 bg-white p-0 text-slate-800 shadow-2xl"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900" id={titleId}>
              {title}
            </h2>
            {description === undefined ? null : (
              <p className="mt-1 text-sm leading-6 text-slate-600" id={descriptionId}>
                {description}
              </p>
            )}
          </div>
          <button
            aria-label={`${title}を閉じる`}
            className="grid min-h-11 min-w-11 place-items-center rounded-lg text-xl text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}
