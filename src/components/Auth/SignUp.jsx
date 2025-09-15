import { useState } from "react";
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
import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setErr("");

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        pass
      );
      await updateProfile(cred.user, { displayName: name.trim() });

      // profil Firestore (approved:false)
      await setDoc(
        doc(db, "user_profiles", cred.user.uid),
        {
          uid: cred.user.uid,
          email: cred.user.email.toLowerCase(),
          displayName: name.trim(),
          approved: false,
          created_at: serverTimestamp(),
        },
        { merge: true }
      );

      // emails admins
      const snap = await getDocs(collection(db, "admins"));
      const adminEmails = snap.docs.map((d) => d.id).filter(Boolean);
      await sendAdminNewSignup({
        toEmails: adminEmails,
        appName: "TelimanShare",
        userName: name.trim(),
        userEmail: cred.user.email.toLowerCase(),
        approveUrl: `${window.location.origin}/demandes`,
      });

      // route hors layout
      navigate("/pending", { replace: true });
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[url('/bg.jpg')] bg-cover bg-center">
      <form
        onSubmit={onSubmit}
        className="bg-white/95 w-[92%] sm:w-[440px] rounded-xl border shadow p-6 space-y-3"
      >
        <h1 className="text-xl font-bold">Créer un compte</h1>
        {err && <div className="p-2 bg-red-50 text-red-700 rounded">{err}</div>}
        <input
          className="input w-full"
          placeholder="Nom"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="input w-full"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input w-full"
          placeholder="Mot de passe"
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          required
        />
        <button disabled={loading} className="btn-primary w-full">
          {loading ? "Création…" : "S’inscrire"}
        </button>
      </form>
    </div>
  );
}
