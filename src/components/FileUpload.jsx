import { useEffect, useRef, useState } from "react";
import { auth, db, storage } from "../firebase";
import { ref as sRef, uploadBytesResumable } from "firebase/storage";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { X, UploadCloud } from "lucide-react";

/* --- Helpers cohérents avec SharePointTable/Documents --- */
function base64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
function normalizeKey(path) {
  if (!path) return "";
  return path.endsWith("/") || path.includes(".") ? path : path + "/";
}
function formatSize(bytes) {
  const s = Number(bytes || 0);
  if (s > 1e6) return (s / 1e6).toFixed(2) + " Mo";
  if (s > 1e3) return (s / 1e3).toFixed(1) + " Ko";
  return `${s} o`;
}

/**
 * Props:
 * - currentPath: string  (chemin relatif dans files/, ex "" ou "FINANCE")
 * - onUpload: () => void (appelé quand tout est terminé avec succès)
 */
export default function FileUpload({ currentPath = "", onUpload }) {
  const me = (auth.currentUser?.email || "").toLowerCase();

  const [queue, setQueue] = useState([]); // [{file, progress, state, error, task}]
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    return () => {
      // cleanup: annuler tous les uploads en cours si on ferme le modal
      queue.forEach((q) => q.task && q.task.cancel && q.task.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    const items = list.map((f) => ({
      file: f,
      progress: 0,
      state: "pending", // pending | uploading | done | error | canceled
      error: null,
      task: null,
    }));
    setQueue((q) => [...q, ...items]);
  }

  async function startUploads() {
    if (!queue.length) return;
    const basePrefix = currentPath ? currentPath + "/" : "";

    // lance un upload par élément
    const promises = queue.map((item, idx) => {
      return new Promise((resolve) => {
        const filename = item.file.name;
        const pathRel = `${basePrefix}${filename}`; // ex: "FINANCE/journal.xlsx"
        const storagePath = "files/" + pathRel;
        const metaId = base64url(normalizeKey(pathRel));

        const metadata = {
          customMetadata: {
            meta_id: metaId,
            owner_email: me || "",
          },
        };

        const task = uploadBytesResumable(
          sRef(storage, storagePath),
          item.file,
          metadata
        );
        // stocker la task pour permettre cancel
        setQueue((q) =>
          q.map((it, i) =>
            i === idx ? { ...it, task, state: "uploading" } : it
          )
        );

        task.on(
          "state_changed",
          (snap) => {
            const pct = Math.round(
              (snap.bytesTransferred / snap.totalBytes) * 100
            );
            setQueue((q) =>
              q.map((it, i) => (i === idx ? { ...it, progress: pct } : it))
            );
          },
          (err) => {
            setQueue((q) =>
              q.map((it, i) =>
                i === idx
                  ? {
                      ...it,
                      state: "error",
                      error: err?.message || String(err),
                    }
                  : it
              )
            );
            resolve(false);
          },
          async () => {
            try {
              // à la fin: créer/merge la meta Firestore (privé par défaut)
              await setDoc(
                doc(db, "metas", metaId),
                {
                  file_path: normalizeKey(pathRel),
                  is_public: false,
                  allowed_emails: [],
                  owner_email: me || "",
                  updated_at: serverTimestamp(),
                },
                { merge: true }
              );
              setQueue((q) =>
                q.map((it, i) =>
                  i === idx ? { ...it, state: "done", progress: 100 } : it
                )
              );
              resolve(true);
            } catch (e) {
              setQueue((q) =>
                q.map((it, i) =>
                  i === idx
                    ? { ...it, state: "error", error: e?.message || String(e) }
                    : it
                )
              );
              resolve(false);
            }
          }
        );
      });
    });

    const results = await Promise.all(promises);
    const ok = results.every(Boolean);
    if (ok) {
      // reset et prévenir le parent de recharger la liste
      setTimeout(() => {
        setQueue([]);
        onUpload && onUpload();
      }, 300);
    }
  }

  function cancelItem(index) {
    const it = queue[index];
    if (it?.task && it.state === "uploading") {
      try {
        it.task.cancel();
      } catch {}
    }
    setQueue((q) =>
      q.map((item, i) => (i === index ? { ...item, state: "canceled" } : item))
    );
  }

  function removeItem(index) {
    setQueue((q) => q.filter((_, i) => i !== index));
  }

  // Drag & drop
  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    addFiles(e.dataTransfer.files);
  }

  const hasUploading = queue.some((q) => q.state === "uploading");
  const canUpload = queue.length > 0 && !hasUploading;

  return (
    <div className="space-y-4">
      {/* DROP ZONE */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition cursor-pointer
          ${
            dragActive
              ? "border-amber-900 bg-[#fff7ec]"
              : "border-gray-300 bg-gray-50"
          }
        `}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragActive(false);
        }}
        onDrop={onDrop}
      >
        <div className="flex items-center justify-center gap-2 text-gray-700">
          <UploadCloud size={20} />
          <span>
            Glissez-déposez vos fichiers ici
            <span className="text-gray-500"> ou cliquez ici pour choisir</span>
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* Sélection */}
      <div className="text-sm text-gray-600">
        Tous les fichiers sont <b>privés</b> par défaut. Vous pourrez gérer les
        accès ensuite via le bouton <b>bouclier</b>.
      </div>

      {/* Liste des fichiers sélectionnés */}
      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center gap-3 p-2 rounded border bg-white shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.file.name}</div>
                <div className="text-xs text-gray-500">
                  {formatSize(item.file.size)} • {item.state}
                  {item.error && (
                    <span className="text-red-600 ml-2">{item.error}</span>
                  )}
                </div>
                <div className="h-2 bg-gray-200 rounded mt-1 overflow-hidden">
                  <div
                    className={`h-2 ${
                      item.state === "error" ? "bg-red-500" : "bg-amber-900"
                    }`}
                    style={{ width: `${item.progress || 0}%` }}
                  />
                </div>
              </div>

              {item.state === "uploading" ? (
                <button
                  className="text-gray-500 hover:text-red-600"
                  title="Annuler"
                  onClick={() => cancelItem(idx)}
                >
                  <X size={18} />
                </button>
              ) : (
                <button
                  className="text-gray-500 hover:text-red-600"
                  title="Retirer"
                  onClick={() => removeItem(idx)}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          className="btn"
          onClick={() => setQueue([])}
          disabled={hasUploading || queue.length === 0}
        >
          Effacer la sélection
        </button>
        <button
          className={`btn-primary ${
            !canUpload ? "opacity-60 cursor-not-allowed" : ""
          }`}
          onClick={startUploads}
          disabled={!canUpload}
        >
          Téléverser
        </button>
      </div>
    </div>
  );
}
