// src/components/ApprovedGate.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import useIsAdmin from "../hooks/useIsAdmin";
import { signOut } from "firebase/auth";

export default function ApprovedGate({ user, children }) {
  const { isAdmin, loading: adminLoading } = useIsAdmin(user);
  const [status, setStatus] = useState({ loading: true, approved: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!user) return;
        if (isAdmin) {
          if (alive) setStatus({ loading: false, approved: true });
          return;
        }
        const snap = await getDoc(doc(db, "user_profiles", user.uid));
        const approved = snap.exists() && !!snap.data().approved;
        if (alive) setStatus({ loading: false, approved });
      } catch {
        if (alive) setStatus({ loading: false, approved: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, isAdmin]);

  if (adminLoading || status.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Chargement…
      </div>
    );
  }

  if (isAdmin || status.approved) return children;

  // Page attente SANS layout
  return (
    <div className="min-h-screen w-full bg-[url('/bg.jpg')] bg-cover bg-center">
      <div className="min-h-screen w-full backdrop-brightness-90 flex items-center justify-center px-4">
        <div className="max-w-lg w-full bg-white/90 rounded-xl shadow p-6 text-center">
          <h1 className="text-2xl font-bold text-amber-900 mb-3">
            Inscription en attente de validation
          </h1>
          <p className="text-gray-700">
            Votre inscription a bien été prise en compte. Vous recevrez un
            e-mail dès qu’un administrateur l’aura validée. Merci de votre
            patience.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="mt-6 inline-flex px-4 py-2 rounded bg-amber-900 text-white hover:bg-amber-800"
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  );
}
