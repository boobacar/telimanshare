// src/components/ToastLite.jsx
import { useEffect } from "react";

/**
 * Toast minimaliste et sobre.
 * props:
 * - open: boolean
 * - message: string
 * - onClose: () => void
 * - duration: ms (par défaut 1800)
 */
export default function ToastLite({ open, message, onClose, duration = 1800 }) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [open, duration, onClose]);

  return (
    <div
      aria-live="polite"
      className={`fixed bottom-4 right-4 z-[1000] transition-all ${
        open
          ? "opacity-100 translate-y-0"
          : "pointer-events-none opacity-0 translate-y-2"
      }`}
    >
      <div className="rounded-lg border border-gray-200 bg-white shadow-md px-3 py-2 text-sm text-gray-800">
        {message}
      </div>
    </div>
  );
}
