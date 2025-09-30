import { NavLink } from "react-router-dom";
import { Folder, Users, Trash2, Home, ClipboardList, History, Lock } from "lucide-react";
import useIsAdmin from "../hooks/useIsAdmin";

export default function SharePointSidebar({ user }) {
  const { isAdmin } = useIsAdmin(user);
  const nav = [
    { label: "Accueil", to: "/", icon: <Home size={19} /> },
    { label: "Documents", to: "/documents", icon: <Folder size={19} /> },
    // { label: "Partagés avec moi", to: "/shared", icon: <Users size={19} /> },
    ...(isAdmin
      ? [
          { label: "Demandes", to: "/demandes", icon: <ClipboardList size={19} /> },
          { label: "Journal", to: "/logs", icon: <History size={19} /> },
          { label: "Corbeille", to: "/trash", icon: <Trash2 size={19} /> },
        ]
      : []),
    { label: "Mot de passe", to: "/password", icon: <Lock size={19} /> },
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
                ? "bg-[#e5f1fb] text-amber-900"
                : "hover:bg-[#e5f1fb] hover:text-amber-900 text-[#323130]"
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
