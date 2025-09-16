// src/components/ApprovedGate.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import useIsAdmin from "../hooks/useIsAdmin";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function ApprovedGate({ user, children }) {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useIsAdmin(user);
  const [status, setStatus] = useState({ loading: true, approved: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!user) return;
        const snap = await getDoc(doc(db, "user_profiles", user.uid));
        const approved = snap.exists() && snap.data()?.approved === true;
        if (alive) setStatus({ loading: false, approved });
      } catch (e) {
        if (alive) setStatus({ loading: false, approved: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (adminLoading || status.loading) {
    return <div className="p-6 text-center">Chargement…</div>;
  }

  // Les admins passent toujours
  if (isAdmin) return children;

  if (!status.approved) {
    const onLogout = async () => {
      try {
        await signOut(auth);
      } catch (e) {
        console.error(e);
      } finally {
        navigate("/signin", { replace: true });
      }
    };

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[url('/bg.jpg')] bg-cover bg-center">
        <div className="max-w-xl w-[92%] sm:w-[520px] bg-white/90 rounded-xl shadow border p-6 text-center">
          <h1 className="text-2xl font-bold text-amber-900">
            Inscription en attente de validation
          </h1>
          <p className="text-gray-700 mt-3">
            Votre inscription a bien été prise en compte. Vous recevrez un
            e-mail dès qu’un administrateur l’aura validée. Merci de votre
            patience.
          </p>
          <button
            onClick={onLogout}
            className="mt-6 inline-flex px-4 py-2 rounded bg-amber-900 text-white hover:bg-amber-800"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
