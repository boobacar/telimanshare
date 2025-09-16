// src/components/Navbar.jsx
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import logo from "../assets/logo.png";
import useIsAdmin from "../hooks/useIsAdmin";

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const { isAdmin } = useIsAdmin(user);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    } finally {
      navigate("/signin", { replace: true });
    }
  };

  return (
    <nav className="w-full bg-green-900 text-white">
      <div className="max-w-6xl mx-auto px-3 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="logo" className="h-7" />
          <span className="font-semibold hidden sm:inline">TelimanShare</span>
        </Link>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link
              to="/demandes"
              className="px-3 py-1 rounded bg-black/20 hover:bg-black/30 text-xs font-semibold"
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
                className="px-3 py-1 rounded bg-black/20 hover:bg-black/30 text-xs font-semibold"
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
      </div>
    </nav>
  );
}
