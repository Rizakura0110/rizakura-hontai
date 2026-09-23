import type { ModalProps, ProductLayoutProps, ToastProps } from "../browser";
import { useTechInbox } from "./runtime";

export function Modal(props: ModalProps) {
  const { ui } = useTechInbox();
  return <ui.Modal {...props} />;
}

export function Toast(props: ToastProps) {
  const { ui } = useTechInbox();
  return <ui.Toast {...props} />;
}

export function ProductLayout(props: ProductLayoutProps) {
  const { ui } = useTechInbox();
  return <ui.ProductLayout {...props} />;
}
