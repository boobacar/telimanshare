// src/components/SharePointHeader.jsx
import { UserCircle, Menu } from "lucide-react";
import { Link } from "react-router-dom";
import { auth } from "../firebase";
import logo from "../assets/logo.png";
import useIsAdmin from "../hooks/useIsAdmin";

export default function SharePointHeader({ user, onMenu }) {
  const { isAdmin } = useIsAdmin(user);

  return (
    <header className="h-14 flex items-center justify-between px-3 sm:px-6 bg-green-900 text-white shadow">
      <div className="flex items-center gap-2">
        <button className="md:hidden mr-1" onClick={onMenu} aria-label="Menu">
          <Menu size={28} />
        </button>
        <img className="h-10" src={logo} alt="Teliman Logistique" />
      </div>

      <div className="flex items-center gap-2">
        {user && isAdmin && (
          <Link
            to="/demandes"
            className="px-3 py-1 rounded bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition"
          >
            Demandes
          </Link>
        )}
        <span className="hidden sm:inline text-sm font-medium">
          {user?.email}
        </span>
        <UserCircle size={30} className="text-amber-900" />
        <button
          onClick={() => auth.signOut()}
          className="px-2 py-1 rounded bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold"
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
}
