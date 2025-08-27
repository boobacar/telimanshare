import { UserCircle, Menu } from "lucide-react";
import { auth } from "../firebase";

export default function SharePointHeader({ user, onMenu }) {
  return (
    <header className="h-14 flex items-center justify-between px-3 sm:px-6 bg-[#0366d6] text-white shadow">
      <div className="flex items-center gap-2">
        <button className="md:hidden mr-1" onClick={onMenu}>
          <Menu size={28} />
        </button>
        <span className="text-xl font-bold tracking-tight font-[Segoe UI]">
          <span className="text-[#a7e0fa]">Teliman</span>
          <span>Share</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-sm font-medium">
          {user?.email}
        </span>
        <UserCircle size={30} className="text-[#a7e0fa]" />
        <button
          onClick={() => auth.signOut()}
          className="px-2 py-1 rounded bg-[#0351a6] hover:bg-[#053267] text-white text-xs font-semibold"
        >
          Déconnexion
        </button>
      </div>
    </header>
  );
}
