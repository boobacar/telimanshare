import { NavLink } from "react-router-dom";
import { Folder, Users, Trash2, Home } from "lucide-react";

export default function SharePointSidebar() {
  const nav = [
    { label: "Accueil", to: "/", icon: <Home size={19} /> },
    { label: "Documents", to: "/documents", icon: <Folder size={19} /> },
    // { label: "Partagés avec moi", to: "/shared", icon: <Users size={19} /> },
    // { label: "Corbeille", to: "/trash", icon: <Trash2 size={19} /> },
  ];

  return (
    <nav className="flex flex-col gap-1 pt-4 h-full text-[#323130]">
      {nav.map(({ label, to, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-2 rounded-md font-medium transition
            ${
              isActive
                ? "bg-[#e5f1fb] text-[#0366d6]"
                : "hover:bg-[#e5f1fb] hover:text-[#0366d6] text-[#323130]"
            }`
          }
          end
        >
          {icon}
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
