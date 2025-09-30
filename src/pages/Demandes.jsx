// src/pages/Demandes.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { sendUserApproved } from "../lib/email";

/* ----------------------------- Modal (1 bouton) ---------------------------- */
function Modal({
  open,
  onClose,
  title,
  message,
  type = "info",
  actionLabel = "OK",
}) {
  const dialogRef = useRef(null);

  const palette = {
    info: {
      ring: "ring-blue-200",
      bg: "bg-blue-50",
      text: "text-blue-800",
      iconBg: "bg-blue-100",
    },
    success: {
      ring: "ring-emerald-200",
      bg: "bg-emerald-50",
      text: "text-emerald-800",
      iconBg: "bg-emerald-100",
    },
    warning: {
      ring: "ring-amber-200",
      bg: "bg-amber-50",
      text: "text-amber-900",
      iconBg: "bg-amber-100",
    },
    error: {
      ring: "ring-rose-200",
      bg: "bg-rose-50",
      text: "text-rose-800",
      iconBg: "bg-rose-100",
    },
  }[type] || {
    ring: "ring-blue-200",
    bg: "bg-blue-50",
    text: "text-blue-800",
    iconBg: "bg-blue-100",
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={dialogRef}
        className={`relative w-[92%] max-w-md rounded-2xl shadow-xl ${palette.bg} ring-1 ${palette.ring} p-5`}
      >
        <div className="flex items-start gap-3">
          <div className={`shrink-0 ${palette.iconBg} rounded-full p-2`}>
            {type === "success" && (
              <svg viewBox="0 0 20 20" className="h-5 w-5 text-emerald-600">
                <path
                  fill="currentColor"
                  d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.6a1 1 0 1 1 1.4-1.4l3 3 6.8-6.8a1 1 0 0 1 1.4 0Z"
                />
              </svg>
            )}
            {type === "error" && (
              <svg viewBox="0 0 20 20" className="h-5 w-5 text-rose-600">
                <path
                  fill="currentColor"
                  d="M10 1.7 18.3 10 10 18.3 1.7 10 10 1.7Zm0 2.3L4 10l6 6 6-6-6-6Zm-.8 3.3h1.6v4.4H9.2V7.3Zm0 5.7h1.6V14H9.2v-1z"
                />
              </svg>
            )}
            {type === "warning" && (
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-amber-600">
                <path
                  fill="currentColor"
                  d="M1 21h22L12 2 1 21Zm12-3h-2v-2h2v2Zm0-4h-2v-4h2v4Z"
                />
              </svg>
            )}
            {type === "info" && (
              <svg viewBox="0 0 20 20" className="h-5 w-5 text-blue-600">
                <path
                  fill="currentColor"
                  d="M10 1.7a8.3 8.3 0 1 1 0 16.6A8.3 8.3 0 0 1 10 1.7Zm0 3a1.2 1.2 0 1 0 0 2.5 1.2 1.2 0 0 0 0-2.5ZM9 9h2v6H9V9Z"
                />
              </svg>
            )}
          </div>
          <div className="grow">
            <h2
              id="modal-title"
              className={`text-lg font-semibold ${palette.text}`}
            >
              {title}
            </h2>
            <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white text-gray-700 border hover:bg-gray-50"
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- ConfirmModal (2 boutons) -------------------------- */
function ConfirmModal({
  open,
  title = "Confirmer l’action",
  message = "Voulez-vous continuer ?",
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onCancel,
  onConfirm,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <div
        ref={ref}
        className="relative w-[92%] max-w-md rounded-2xl shadow-xl bg-white ring-1 ring-gray-200 p-5"
      >
        <h2 id="confirm-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
          {message}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-white text-gray-700 border hover:bg-gray-50"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Page --------------------------------- */
export default function Demandes() {
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [isAdmin, setIsAdmin] = useState(null); // null: inconnu
  const [loading, setLoading] = useState(true);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [approvingId, setApprovingId] = useState(null);
  const [error, setError] = useState("");

  // Modal 1 bouton (info/success/error)
  const [modal, setModal] = useState({
    open: false,
    title: "",
    message: "",
    type: "info",
  });
  const openModal = (payload) => setModal({ open: true, ...payload });
  const closeModal = () => setModal((m) => ({ ...m, open: false }));

  // Modal de confirmation (2 boutons)
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);

  // Suivi auth + check admin
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setMe(user || null);
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      try {
        const adminRef = doc(
          db,
          "admins",
          String(user.email || "").toLowerCase()
        );
        const adminSnap = await getDoc(adminRef);
        setIsAdmin(adminSnap.exists());
      } catch (e) {
        console.error(e);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Charger la liste des non approuvés
  const loadPending = useCallback(async () => {
    setError("");
    try {
      const q = query(
        collection(db, "user_profiles"),
        where("approved", "==", false)
      );
      const snap = await getDocs(q);
      const items = [];
      snap.forEach((d) => {
        const data = d.data() || {};
        items.push({
          id: d.id, // doc id = uid
          uid: d.id,
          name: data.name || data.displayName || "",
          email: data.email || "",
          approved: !!data.approved,
          createdAt: data.createdAt || null,
        });
      });
      items.sort(
        (a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)
      );
      setPendingUsers(items);
    } catch (e) {
      console.error(e);
      setError("Impossible de charger les demandes.");
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadPending();
  }, [isAdmin, loadPending]);

  // Approuver un utilisateur
  const approve = useCallback(
    async (u) => {
      if (!u?.uid) return;

      if (!u.email) {
        openModal({
          title: "Aucune adresse e-mail",
          message:
            "Ce profil n’a pas d’e-mail enregistré.\nL’utilisateur sera approuvé, mais aucune notification ne pourra être envoyée.",
          type: "warning",
        });
      }

      setError("");
      setApprovingId(u.uid);

      try {
        const ref = doc(db, "user_profiles", u.uid);
        await updateDoc(ref, { approved: true, approvedAt: serverTimestamp() });

        if (u.email) {
          await sendUserApproved(u.email, u.name);
        }

        setPendingUsers((prev) => prev.filter((x) => x.uid !== u.uid));

        openModal({
          title: "Inscription approuvée",
          message:
            "L’utilisateur a été approuvé avec succès.\nUn e-mail de confirmation lui a été envoyé.",
          type: "success",
        });
      } catch (err) {
        console.error(err);
        const text = err?.text || err?.message || JSON.stringify(err);
        setError("Échec de l’approbation : " + text);

        openModal({
          title: "Échec de l’approbation",
          message: String(text),
          type: "error",
        });

        await loadPending();
      } finally {
        setApprovingId(null);
      }
    },
    [loadPending]
  );

  // Ouverture du modal de confirmation pour refuser
  const askReject = useCallback((u) => {
    setConfirmTarget(u || null);
    setConfirmOpen(true);
  }, []);

  // Confirmer la suppression
  const confirmReject = useCallback(async () => {
    const u = confirmTarget;
    setConfirmOpen(false);
    if (!u?.uid) return;

    try {
      const ref = doc(db, "user_profiles", u.uid);
      await deleteDoc(ref);

      setPendingUsers((prev) => prev.filter((x) => x.uid !== u.uid));

      openModal({
        title: "Demande supprimée",
        message: "La demande a été supprimée.",
        type: "info",
      });
    } catch (err) {
      console.error(err);
      openModal({
        title: "Erreur",
        message:
          "Impossible de supprimer demande : " + (err?.message || String(err)),
        type: "error",
      });
    } finally {
      setConfirmTarget(null);
    }
  }, [confirmTarget]);

  // Etats d'accès
  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-pulse">Chargement…</div>
      </div>
    );
  }
  if (!me) {
    navigate("/signin", { replace: true });
    return null;
  }
  if (isAdmin === false) {
    return (
      <div className="p-6 text-center">
        <h1 className="text-xl font-semibold">Accès refusé</h1>
        <p className="text-gray-600 mt-2">
          Cette page est réservée aux administrateurs.
        </p>
      </div>
    );
  }

  // Rendu
  return (
    <div className="relative bg-white/50 min-h-[88vh] max-w-3xl mx-auto p-4 ">
      <h1 className="text-2xl font-bold text-amber-900">
        Demandes d’inscription
      </h1>
      <p className="text-gray-600 mt-1">
        Comptes en attente de validation par un administrateur.
      </p>

      {error && (
        <div className="mt-4 rounded border border-red-300 bg-red-50 p-3 text-red-800 text-sm">
          {error}
        </div>
      )}

      <div className="mt-5">
        {pendingUsers.length === 0 ? (
          <div className="text-gray-500">Aucune demande en attente.</div>
        ) : (
          <ul className="space-y-3">
            {pendingUsers.map((u) => (
              <li
                key={u.id}
                className="border rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <div className="font-semibold">{u.name || "(Sans nom)"}</div>
                  <div className="text-sm text-gray-600">{u.email || "—"}</div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approve(u)}
                    disabled={approvingId === u.uid}
                    className={`px-3 py-1 rounded text-white font-semibold ${
                      approvingId === u.uid
                        ? "bg-emerald-400 cursor-not-allowed"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                  >
                    {approvingId === u.uid
                      ? "Validation…"
                      : "Valider l’inscription"}
                  </button>

                  <button
                    onClick={() => askReject(u)}
                    className="px-3 py-1 rounded bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                  >
                    Refuser
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal d'information */}
      <Modal
        open={modal.open}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />

      {/* Modal de confirmation */}
      <ConfirmModal
        open={confirmOpen}
        title="Refuser cette demande ?"
        message={
          confirmTarget
            ? `Vous allez supprimer définitivement la demande de:\n• ${
                confirmTarget.name || "(Sans nom)"
              }\n• ${
                confirmTarget.email || "—"
              }\n\nCette action est irréversible.`
            : "Supprimer définitivement cette demande ?"
        }
        confirmLabel="Oui, supprimer"
        cancelLabel="Annuler"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmReject}
      />
    </div>
  );
}
