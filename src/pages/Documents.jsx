// src/pages/Documents.jsx
import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Modal from "../components/Modal";
import SharePointBreadcrumb from "../components/SharePointBreadcrumb";
import SharePointTable from "../components/SharePointTable";
import FileUpload from "../components/FileUpload";

import { getStorage, ref as sRef, uploadString } from "firebase/storage";
import { auth, db } from "../firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Plus } from "lucide-react";

function base64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export default function Documents({ user }) {
  const location = useLocation();
  const [currentPath, setCurrentPath] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [uploadModal, setUploadModal] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dropRef = useRef(null);

  // Initialiser le chemin depuis la query ?from=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const init = params.get("from");
    if (init != null) setCurrentPath(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  function handleUploadSuccess() {
    setRefresh((r) => r + 1);
    setUploadModal(false);
  }

  async function handleCreateFolder(name) {
    if (!name) {
      setFolderModal(false);
      return;
    }
    const me = (auth.currentUser?.email || "").toLowerCase();
    const storage = getStorage();

    const folderPath = (currentPath ? currentPath + "/" : "") + name;
    const fileRef = sRef(
      storage,
      `files/${folderPath}/.emptyFolderPlaceholder`
    );

    try {
      await uploadString(fileRef, "", "raw", {
        customMetadata: { owner_email: me },
      });

      const metaId = base64url(folderPath + "/");
      await setDoc(
        doc(db, "metas", metaId),
        {
          file_path: folderPath + "/",
          owner_email: me,
          is_public: false,
          allowed_emails: [],
          updated_at: serverTimestamp(),
        },
        { merge: true }
      );

      setRefresh((r) => r + 1);
      setFolderModal(false);
    } catch (e) {
      alert("Erreur création dossier : " + (e?.message || e));
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) setUploadModal(true);
  }

  function goUp() {
    if (!currentPath) return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.join("/"));
  }

  return (
    <div className="relative w-full overflow-x-hidden">
      {/* Barre du haut */}
      <div className="mx-auto max-w-screen-xl px-3 sm:px-4 pt-3 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1 min-w-0">
            <SharePointBreadcrumb
              currentPath={currentPath}
              onNavigate={setCurrentPath}
            />
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {currentPath && (
              <button
                className="flex items-center gap-1 px-3 py-2 rounded border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 shadow-sm"
                onClick={goUp}
                title="Revenir au dossier parent"
              >.
                <span className="text-lg leading-none">←</span>
                <span>Retour</span>
              </button>
            )}
            <button
              className="flex items-center gap-1 bg-[#e5f1fb] text-amber-900 px-3 py-2 rounded shadow-sm font-semibold hover:bg-[#cce6fa] transition self-end sm:self-auto"
              onClick={() => setFolderModal(true)}
            >
              <Plus size={18} /> Créer un dossier
            </button>
          </div>
        </div>

        <div className="mt-2">
          <button
            className="px-4 py-2 rounded bg-amber-900 text-white font-semibold hover:bg-amber-800 transition"
            onClick={() => setUploadModal(true)}
          >
            Ajouter un/des fichier(s)
          </button>
        </div>
      </div>

      {/* Table + drop zone */}
      <div ref={dropRef} className="mx-auto max-w-screen-xl px-2 sm:px-4 pb-6">
        <div
          className={`relative rounded-xl border border-gray-200 bg-white transition shadow ${
            dragActive ? "ring-4 ring-amber-900/40 bg-[#e5f1fb]" : ""
          }`}
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
          <SharePointTable
            user={user}
            currentPath={currentPath}
            onNavigate={setCurrentPath}
            refresh={refresh}
          />
          {dragActive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-amber-900 font-bold text-lg bg-white/90 px-5 py-4 rounded-xl border-2 border-dashed border-amber-900 shadow">
                Glissez-déposez des fichiers ici
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Téléversement */}
      <Modal
        open={uploadModal}
        title="Téléverser un ou plusieurs fichiers"
        onClose={() => setUploadModal(false)}
      >
        <FileUpload currentPath={currentPath} onUpload={handleUploadSuccess} />
      </Modal>

      {/* Modal création dossier */}
      <Modal
        open={folderModal}
        title="Créer un dossier"
        onClose={() => setFolderModal(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreateFolder(e.target.folderName.value);
          }}
          className="space-y-4"
        >
          <input
            name="folderName"
            type="text"
            className="input w-full"
            placeholder="Nom du dossier"
            autoFocus
            required
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn"
              onClick={() => setFolderModal(false)}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              Créer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
