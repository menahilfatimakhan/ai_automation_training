"use client";

import { useTransition } from "react";
import { toast } from "@/components/Toast";

/**
 * A form that invokes a server action and surfaces success/error as a toast —
 * without changing the action's signature. The action still runs on the server
 * (and revalidates); we just await it client-side to give feedback.
 */
export function ActionForm({
  action,
  success,
  className,
  children,
  resetOnSuccess = false,
}: {
  action: (formData: FormData) => Promise<void>;
  success?: string;
  className?: string;
  children: React.ReactNode;
  resetOnSuccess?: boolean;
}) {
  const [, start] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        start(async () => {
          try {
            await action(formData);
            if (success) toast(success, "success");
            if (resetOnSuccess) form.reset();
          } catch (err) {
            toast((err as Error)?.message || "Something went wrong", "error");
          }
        });
      }}
    >
      {children}
    </form>
  );
}
