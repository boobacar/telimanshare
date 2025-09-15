// src/components/Navbar.jsx
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import logo from "../assets/logo.png";
import useIsAdmin from "../hooks/useIsAdmin"; // <- ton hook (ou remplace par ta logique)

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin(user); // renvoie { isAdmin, loading }

  const handleLogout = async () => {
    try {
      await auth.signOut();
    } finally {
      navigate("/signin");
    }
  };

  return (
    <nav className="flex flex-wrap justify-between items-center p-4 bg-green-900 text-white shadow z-10">
      {/* Logo */}
      <Link to="/" className="drop-shadow">
        <img className="h-10" src={logo} alt="Teliman Logistique" />
      </Link>

      {/* Liens / actions */}
      <div className="flex items-center gap-2">
        {/* Lien Demandes (admins uniquement) */}
        {user && isAdmin && (
          <Link
            to="/demandes"
            className="px-3 py-1 rounded bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition"
          >
            Demandes
          </Link>
        )}

        {user ? (
          <>
            <span className="hidden sm:inline text-gray-100 text-sm">
              {user.email}
            </span>
            <button
              className="ml-1 px-3 py-1 rounded bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition"
              onClick={handleLogout}
            >
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <Link
              to="/signin"
              className="px-4 py-1 rounded bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition"
            >
              Connexion
            </Link>
            <Link
              to="/signup"
              className="px-4 py-1 rounded bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition"
            >
              Inscription
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
