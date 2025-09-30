import { useState } from "react";
import { auth, db } from "../firebase";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { logActivity } from "../lib/activityLog";
import { Eye, EyeOff } from "lucide-react";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      if (!auth.currentUser) {
        setError("Aucun utilisateur connecté.");
        return;
      }

      if (newPassword !== confirmPassword) {
        setError("La confirmation ne correspond pas au nouveau mot de passe.");
        return;
      }

      if (newPassword.length < 6) {
        setError(
          "Le nouveau mot de passe doit contenir au moins 6 caractères."
        );
        return;
      }

      setLoading(true);

      // 1) Ré-authentifier avec le mot de passe actuel
      const cred = EmailAuthProvider.credential(
        auth.currentUser.email || "",
        currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, cred);

      // 2) Mettre à jour le mot de passe
      await updatePassword(auth.currentUser, newPassword);

      // 3) Log (best-effort)
      try {
        await logActivity(db, auth.currentUser, { action: "change_password" });
      } catch {}

      setSuccess("Mot de passe mis à jour avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      // Mapping rapide des erreurs Firebase vers FR
      const code = err?.code || "";
      if (code === "auth/wrong-password")
        setError("Le mot de passe actuel est incorrect.");
      else if (code === "auth/weak-password")
        setError("Mot de passe trop faible (min. 6 caractères).");
      else if (code === "auth/too-many-requests")
        setError("Trop de tentatives. Réessayez plus tard.");
      else if (code === "auth/requires-recent-login")
        setError("Action sensible. Veuillez vous reconnecter, puis réessayer.");
      else setError(err?.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative p-4 sm:p-6">
      <div className="max-w-lg mx-auto bg-white border rounded-xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-green-900 mb-4">
          Changer mon mot de passe
        </h1>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Mot de passe actuel
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                className="w-full p-2 border-2 border-green-800 rounded focus:border-green-900 transition pr-10"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-600 hover:text-gray-800"
                aria-label={
                  showCurrent
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                className="w-full p-2 border-2 border-green-800 rounded focus:border-green-900 transition pr-10"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNew((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-600 hover:text-gray-800"
                aria-label={
                  showNew
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                className="w-full p-2 border-2 border-green-800 rounded focus:border-green-900 transition pr-10"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center text-gray-600 hover:text-gray-800"
                aria-label={
                  showConfirm
                    ? "Masquer le mot de passe"
                    : "Afficher le mot de passe"
                }
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded bg-amber-800 hover:bg-amber-900 disabled:opacity-60 text-white font-semibold"
          >
            {loading ? "Mise à jour…" : "Mettre à jour"}
          </button>

          {error && (
            <div className="text-red-600">
              {error === "Firebase: Error (auth/invalid-credential)."
                ? "Mot de passe actuel incorrecte."
                : error}
            </div>
          )}
          {success && <div className="text-green-700">{success}</div>}
        </form>
      </div>
    </div>
  );
}
