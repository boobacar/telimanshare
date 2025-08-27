import { ChevronRight } from "lucide-react";

export default function SharePointBreadcrumb({ currentPath = "", onNavigate }) {
  const parts = currentPath ? currentPath.split("/") : [];
  let path = "";

  return (
    <nav className="flex items-center text-sm mb-2 pl-1 pt-2 pb-1 flex-wrap">
      <button
        onClick={() => onNavigate("")}
        className="text-amber-900 font-semibold hover:underline"
      >
        Documents
      </button>
      {parts.map((part, idx) => {
        path += (path ? "/" : "") + part;
        return (
          <span key={idx} className="flex items-center">
            <ChevronRight size={16} className="mx-1 text-gray-400" />
            <button
              onClick={() => onNavigate(path)}
              className={`hover:underline ${
                idx === parts.length - 1
                  ? "text-amber-900 font-semibold"
                  : "text-[#323130]"
              }`}
            >
              {part}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
