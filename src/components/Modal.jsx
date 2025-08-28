import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Modal accessible, scrollable, qui verrouille le body scroll.
 *
 * Props:
 * - open: boolean
 * - title: string | node
 * - onClose: () => void
 * - children: contenu du modal
 * - size: "sm" | "md" | "lg" | "xl" (default "lg")
 * - bodyClassName: string (classes tailwind additionnelles sur le body interne)
 * - footer: node (optionnel, zone pied de page)
 */
export default function Modal({
  open,
  title,
  onClose,
  children,
  footer = null,
  size = "lg",
  bodyClassName = "",
}) {
  const overlayRef = useRef(null);
  const panelRef = useRef(null);

  // Fermer sur ESC et lock/unlock le scroll de la page
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthMap = {
    sm: "max-w-md",
    md: "max-w-xl",
    lg: "max-w-3xl",
    xl: "max-w-5xl",
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1000] flex items-start md:items-center justify-center p-3 md:p-6 bg-black/40"
      onMouseDown={(e) => {
        // fermer si on clique à l'extérieur du panneau
        if (e.target === overlayRef.current) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={`w-full ${widthMap[size]} bg-white rounded-xl shadow-xl border border-gray-200
                    max-h-[90vh] flex flex-col`}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-b">
          <h3 className="font-semibold text-gray-800 truncate">{title}</h3>
          <button
            className="p-2 rounded hover:bg-gray-100"
            onClick={onClose}
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* BODY (scrollable) */}
        <div className={`flex-1 overflow-y-auto p-4 ${bodyClassName}`}>
          {children}
        </div>

        {/* FOOTER (optionnel) */}
        {footer && <div className="px-4 py-3 border-t">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
