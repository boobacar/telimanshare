import { Link, useNavigate } from "react-router-dom";
import { auth } from "../firebase";

export default function Navbar({ user }) {
  const navigate = useNavigate();
  const handleLogout = () => {
    auth.signOut();
    navigate("/signin");
  };

  return (
    <nav className="flex flex-wrap justify-between items-center p-4 bg-green-900 text-white shadow">
      {/* Logo */}
      <Link
        to="/"
        className="text-2xl sm:text-4xl font-pacifico font-bold tracking-wide text-blue-200 drop-shadow"
        style={{ letterSpacing: "0.04em" }}
      >
        <span className="text-amber-900">T</span>
        <span className="text-white">S</span>
      </Link>

      <div>
        {user ? (
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-gray-100">{user.email}</span>
            <button
              className="ml-1 px-3 py-1 rounded bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition"
              onClick={handleLogout}
            >
              Déconnexion
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>
    </nav>
  );
}
