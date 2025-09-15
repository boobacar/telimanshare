// src/pages/Approve.jsx
import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import useIsAdmin from "../hooks/useIsAdmin";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import emailjs from "@emailjs/browser";

export default function Approve() {
  const [user] = useAuthState(auth);
  const { isAdmin, loading: adminLoading } = useIsAdmin(user);
  const [params] = useSearchParams();
  const [state, setState] = useState({ loading: true, ok: false, msg: "" });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (adminLoading) return;
        if (!user) {
          setState({
            loading: false,
            ok: false,
            msg: "Veuillez vous connecter en tant qu’administrateur.",
          });
          return;
        }
        if (!isAdmin) {
          setState({
            loading: false,
            ok: false,
            msg: "Accès réservé aux administrateurs.",
          });
          return;
        }

        const uid = params.get("uid");
        const toName = params.get("name") || "";
        const toEmail = params.get("email");

        if (!uid || !toEmail) {
          setState({
            loading: false,
            ok: false,
            msg: "Lien invalide (paramètres manquants).",
          });
          return;
        }

        // marquer approuvé
        await setDoc(
          doc(db, "user_profiles", uid),
          { approved: true },
          { merge: true }
        );

        // envoyer email de confirmation à l’utilisateur
        await emailjs.send(
          import.meta.env.VITE_EMAILJS_SERVICE_ID,
          import.meta.env.VITE_EMAILJS_USER_TEMPLATE_ID, // <- template “utilisateur approuvé”
          {
            to_email: toEmail,
            to_name: toName || toEmail,
            app_name: "TelimanShare",
            login_url: `${window.location.origin}/signin`,
          }
        );

        if (alive)
          setState({
            loading: false,
            ok: true,
            msg: "L’inscription a été validée et l’utilisateur a été notifié par e-mail.",
          });
      } catch (e) {
        if (alive)
          setState({
            loading: false,
            ok: false,
            msg: e?.message || "Erreur lors de la validation.",
          });
      }
    })();
    return () => {
      alive = false;
    };
  }, [user, isAdmin, adminLoading, params]);

  if (state.loading) return <Centered>Validation en cours…</Centered>;

  return (
    <Centered>
      <div
        className={`p-5 rounded-xl max-w-lg w-full text-center ${
          state.ok
            ? "bg-green-50 border border-green-200"
            : "bg-red-50 border border-red-200"
        }`}
      >
        <h1 className="text-xl font-bold mb-2">
          {state.ok ? "Succès" : "Erreur"}
        </h1>
        <p className="text-gray-700">{state.msg}</p>
        <div className="mt-4">
          <Link className="text-amber-900 underline" to="/demandes">
            ← Retour aux demandes
          </Link>
        </div>
      </div>
    </Centered>
  );
}

function Centered({ children }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 px-4">
      {children}
    </div>
  );
}
