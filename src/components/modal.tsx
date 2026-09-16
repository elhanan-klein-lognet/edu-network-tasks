"use client";

import type { ReactNode } from "react";

/**
 * Generic centered popup: click the backdrop (or the ✕ inside the content)
 * to close. `wide` gives forms/detail panels a bit more room than a
 * plain confirmation would need.
 */
export function Modal({
  onClose,
  children,
  wide,
}: {
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`max-h-[90vh] w-full ${
          wide ? "max-w-lg" : "max-w-md"
        } overflow-y-auto rounded-lg bg-white p-5 shadow-lg`}
      >
        {children}
      </div>
    </div>
  );
}
