import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import SignIn from "./components/Auth/SignIn";
import SignUp from "./components/Auth/SignUp";
import Documents from "./pages/Documents";
import Dashboard from "./pages/Dashboard";
import { auth } from "./firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import Navbar from "./components/Navbar";
import SharePointLayout from "./components/SharePointLayout";
import Footer from "./components/Footer";
// ... (autres imports)

export default function App() {
  const [user, loading] = useAuthState(auth);

  if (loading) return <div>Loading...</div>;

  return (
    <Router>
      <Routes>
        {/* Auth pages : sans layout */}
        <Route
          path="/signin"
          element={
            !user ? (
              <>
                <Navbar /> <SignIn />
              </>
            ) : (
              <Navigate to="/" />
            )
          }
        />
        <Route
          path="/signup"
          element={
            !user ? (
              <>
                <Navbar /> <SignUp />
              </>
            ) : (
              <Navigate to="/" />
            )
          }
        />

        {/* Toutes les pages SharePoint */}
        <Route
          path="*"
          element={
            user ? (
              <SharePointLayout user={user}>
                <Routes>
                  <Route path="/" element={<Dashboard user={user} />} />
                  <Route
                    path="/documents"
                    element={<Documents user={user} />}
                  />
                  {/* Ajoute ici d'autres pages dans le layout */}
                  {/* ... */}
                  <Route path="*" element={<Navigate to="/documents" />} />
                </Routes>
              </SharePointLayout>
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
