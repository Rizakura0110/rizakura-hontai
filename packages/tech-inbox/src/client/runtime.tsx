import { createContext, type ReactNode, useContext } from "react";
import type { TechInboxRuntime } from "../browser";

const RuntimeContext = createContext<TechInboxRuntime | null>(null);

export function TechInboxProvider({
  client,
  ui,
  children,
}: TechInboxRuntime & { readonly children: ReactNode }) {
  return <RuntimeContext.Provider value={{ client, ui }}>{children}</RuntimeContext.Provider>;
}

export function useTechInbox(): TechInboxRuntime {
  const runtime = useContext(RuntimeContext);
  if (runtime === null) throw new Error("Tech Inbox requires an injected client and UI.");
  return runtime;
}
