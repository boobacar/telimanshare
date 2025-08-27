import { useEffect } from "react";

// props : { open, type, message, onClose }
export default function Toast({ open, type = "info", message, onClose }) {
  useEffect(() => {
    if (open) {
      const t = setTimeout(onClose, 3000);
      return () => clearTimeout(t);
    }
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className={`fixed z-50 bottom-6 left-1/2 -translate-x-1/2
      px-5 py-3 rounded-xl shadow-xl border text-white
      ${type === "success" ? "bg-green-600 border-green-500" : ""}
      ${type === "error" ? "bg-red-600 border-red-500" : ""}
      ${type === "info" ? "bg-blue-600 border-blue-500" : ""}
      animate-fade-in
    `}
      style={{ minWidth: 200, maxWidth: 400 }}
      role="alert"
    >
      <span className="font-bold mr-2">
        {type === "success" && "✅"}
        {type === "error" && "❌"}
        {type === "info" && "ℹ️"}
      </span>
      {message}
    </div>
  );
}
