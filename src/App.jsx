import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "./firebase";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

import Navbar from "./components/Navbar";
import SharePointLayout from "./components/SharePointLayout";
import Footer from "./components/Footer";

import SignIn from "./components/Auth/SignIn";
import SignUp from "./components/Auth/SignUp";
import Pending from "./pages/Pending";
import Documents from "./pages/Documents";
import Dashboard from "./pages/Dashboard";
import Demandes from "./pages/Demandes";
import Trash from "./pages/Trash";
import ActivityLog from "./pages/ActivityLog";
import ChangePassword from "./pages/ChangePassword";
import AdminRoute from "./components/AdminRoute";
import useIsAdmin from "./hooks/useIsAdmin";
import { logActivity } from "./lib/activityLog";

function ApprovedGuard({ user, children }) {
  const { isAdmin, loading: loadingAdmin } = useIsAdmin(user);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!user) return;
        const snap = await getDoc(doc(db, "user_profiles", user.uid));
        const ok = snap.exists() && snap.data()?.approved === true;
        if (alive) setApproved(ok);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (loading || loadingAdmin)
    return <div className="p-6 text-center">Chargement…</div>;

  // Admins passent toujours
  if (isAdmin) return children;

  // Utilisateur non approuvé -> hors layout
  if (!approved) return <Navigate to="/pending" replace />;

  return children;
}

export default function App() {
  const [user, loading] = useAuthState(auth);
  // Log simple connexion côté client
  useEffect(() => {
    (async () => {
      try {
        if (user) await logActivity(db, user, { action: "login" });
      } catch {}
    })();
  }, [user]);
  if (loading) return <div className="p-6 text-center">Chargement…</div>;

  return (
    <Router>
      <Routes>
        {/* Auth HORS layout */}
        <Route
          path="/signin"
          element={
            !user ? (
              <>
                <Navbar />
                <SignIn />
              </>
            ) : (
              <Navigate to="/documents" />
            )
          }
        />
        <Route
          path="/signup"
          element={
            !user ? (
              <>
                <Navbar />
                <SignUp />
              </>
            ) : (
              <Navigate to="/documents" />
            )
          }
        />
        <Route path="/pending" element={<Pending />} />

        {/* Tout le reste sous layout seulement si admin OU approuvé */}
        <Route
          path="*"
          element={
            user ? (
              <ApprovedGuard user={user}>
                <SharePointLayout user={user}>
                  <Routes>
                    <Route path="/" element={<Dashboard user={user} />} />
                    <Route
                      path="/documents"
                      element={<Documents user={user} />}
                    />
                    <Route
                      path="/demandes"
                      element={
                        <AdminRoute user={user}>
                          <Demandes />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/trash"
                      element={
                        <AdminRoute user={user}>
                          <Trash />
                        </AdminRoute>
                      }
                    />
                    <Route
                      path="/logs"
                      element={
                        <AdminRoute user={user}>
                          <ActivityLog />
                        </AdminRoute>
                      }
                    />
                    <Route path="/password" element={<ChangePassword />} />
                    <Route path="*" element={<Navigate to="/documents" />} />
                  </Routes>
                </SharePointLayout>
              </ApprovedGuard>
            ) : (
              <Navigate to="/signin" />
            )
          }
        />
      </Routes>
      <Footer />
    </Router>
  );
}
