import { Navigate } from "react-router-dom";
import useIsAdmin from "../hooks/useIsAdmin";

export default function AdminRoute({ user, children }) {
  const { isAdmin, loading } = useIsAdmin(user);
  if (loading) return <div className="p-6 text-center">Chargement…</div>;
  return isAdmin ? children : <Navigate to="/documents" replace />;
}
