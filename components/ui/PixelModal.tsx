"use client";

import { type ReactNode } from "react";

interface PixelModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Reusable pixel-bordered "sub window" -- same black/white game-UI look as
 * every panel on the site, used for the Me page's Change Profile / Change
 * Layout dialogs and anywhere else a screen needs a focused sub-view. */
export function PixelModal({ open, title, onClose, children }: PixelModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm border-4 border-[var(--px-border)] shadow-[6px_6px_0_var(--px-shadow)]"
        style={{ backgroundColor: "var(--px-white)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-3 border-b-4 border-[var(--px-border)]"
          style={{ backgroundColor: "var(--px-text)" }}
        >
          <h2 className="text-sm font-bold" style={{ color: "var(--px-white)" }}>{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-btn px-btn-ghost px-btn-sm"
            aria-label="Close"
          >
            X
          </button>
        </div>
        <div className="p-4 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
