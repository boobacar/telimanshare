// src/pages/SignUp.jsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../../firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import {
  doc,
  setDoc,
  serverTimestamp,
  collection,
  getDocs,
} from "firebase/firestore";
import { sendAdminNewSignup } from "../../lib/email";
import { Eye, EyeOff } from "lucide-react";

export default function SignUp() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  const EMAILS_KEY = "teliman_saved_emails";
  const saveEmail = (e) => {
    const norm = (e || "").trim().toLowerCase();
    if (!norm) return;
    try {
      const raw = localStorage.getItem(EMAILS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(arr)
        ? [norm, ...arr.filter((x) => x !== norm)].slice(0, 8)
        : [norm];
      localStorage.setItem(EMAILS_KEY, JSON.stringify(next));
    } catch {}
  };

  const onChange = (e) => {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { name, email, password } = values;

      // 1) Auth
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }

      // 2) Profil Firestore
      const uid = cred.user.uid;
      const profile = {
        uid,
        name: name || cred.user.displayName || "",
        email: (cred.user.email || "").toLowerCase(),
        approved: false,
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "user_profiles", uid), profile);

      // 3) Notifier tous les admins
      try {
        const adminsSnap = await getDocs(collection(db, "admins"));
        const tasks = [];
        adminsSnap.forEach((d) => {
          const adminEmail = (d.id || "").trim().toLowerCase(); // id = email
          if (adminEmail) {
            tasks.push(
              sendAdminNewSignup(adminEmail, {
                uid,
                email: profile.email,
                name: profile.name,
              })
            );
          }
        });
        await Promise.allSettled(tasks);
      } catch (notifyErr) {
        console.error("Notification admins échouée (inscription) :", notifyErr);
        // On laisse passer l'inscription même si la notif échoue
      }

      // 4) Mémoriser l'email localement pour les futures connexions
      saveEmail(email);

      // 5) Redirection
      navigate("/pending", { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.message || "Inscription impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[88vh] w-full flex items-center justify-center bg-[url('/bg.jpg')] bg-cover bg-center">
      <div className="max-w-md w-[92%] sm:w-[480px] bg-white/90 rounded-xl shadow border p-6">
        <h1 className="text-2xl font-bold text-amber-900">Créer un compte</h1>
        <p className="text-gray-600 mt-1">
          Un administrateur devra valider votre inscription.
        </p>

        {error && (
          <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium">Nom</label>
            <input
              type="text"
              name="name"
              value={values.name}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="Votre nom"
              autoComplete="name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              name="email"
              value={values.email}
              onChange={onChange}
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="vous@exemple.com"
              autoComplete="email"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Mot de passe</label>
            <div className="relative mt-1">
              <input
                type={showPwd ? "text" : "password"}
                name="password"
                value={values.password}
                onChange={onChange}
                className="w-full border rounded px-3 py-2 pr-10"
                placeholder="••••••••"
                autoComplete="new-password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-600 hover:text-gray-800"
                aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full mt-2 px-4 py-2 rounded text-white font-semibold ${
              submitting
                ? "bg-amber-400 cursor-not-allowed"
                : "bg-amber-900 hover:bg-amber-800"
            }`}
          >
            {submitting ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <div className="mt-4 text-sm text-gray-600">
          Déjà un compte ?{" "}
          <Link
            to="/signin"
            className="text-amber-900 font-semibold hover:underline"
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  );
}
