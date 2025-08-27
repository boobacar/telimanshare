import { useState, useRef } from "react";
import { supabase } from "../supabase";
import SharePointBreadcrumb from "../components/SharePointBreadcrumb";
import SharePointTable from "../components/SharePointTable";
import FileUpload from "../components/FileUpload";
import Modal from "../components/Modal";
import { Plus } from "lucide-react";

export default function Documents({ user }) {
  const [currentPath, setCurrentPath] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [uploadModal, setUploadModal] = useState(false);
  const [folderModal, setFolderModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dropRef = useRef();

  function handleUploadSuccess() {
    setRefresh((r) => r + 1);
    setUploadModal(false);
  }

  // ✅ CREATION DOSSIER FONCTIONNELLE !
  function handleCreateFolder(name) {
    if (!name) {
      setFolderModal(false);
      return;
    }
    const folderPath =
      (currentPath ? currentPath + "/" : "") +
      name +
      "/.emptyFolderPlaceholder";
    const blob = new Blob([""], { type: "text/plain" });

    supabase.storage
      .from("files")
      .upload(folderPath, blob)
      .then(({ error }) => {
        if (error) {
          alert("Erreur création dossier : " + error.message);
        }
        setRefresh((r) => r + 1);
        setFolderModal(false);
      });
  }

  // Drag & drop sur la table
  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      setUploadModal(true);
      // Tu peux stocker files dans un état si tu veux pré-remplir FileUpload plus tard
    }
  }

  return (
    <div className="w-full px-2 pt-2 pb-6">
      {/* Breadcrumb + bouton dossier */}
      <div className="flex flex-col sm:flex-row sm:items-center items-stretch gap-2 mb-2">
        <div className="flex-1">
          <SharePointBreadcrumb
            currentPath={currentPath}
            onNavigate={setCurrentPath}
          />
        </div>
        <button
          className="flex items-center gap-1 bg-[#e5f1fb] text-amber-900 px-3 py-1 rounded shadow-sm font-semibold hover:bg-[#cce6fa] transition self-end"
          onClick={() => setFolderModal(true)}
        >
          <Plus size={18} /> Créer un dossier
        </button>
      </div>
      {/* Command bar */}
      <div className="flex gap-2 mb-2">
        <button
          className="px-4 py-1 rounded bg-amber-900 text-white font-semibold hover:bg-blue-700 transition"
          onClick={() => setUploadModal(true)}
        >
          Ajouter un/des fichier(s)
        </button>
      </div>
      {/* Table drag & drop */}
      <div
        ref={dropRef}
        className={`relative rounded-xl border border-gray-200 bg-white transition shadow
          ${dragActive ? "ring-4 ring-amber-900/40 bg-[#e5f1fb]" : ""}
        `}
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
            <div className="text-amber-900 font-bold text-lg bg-white/80 px-5 py-4 rounded-xl border-2 border-dashed border-amber-900 shadow">
              Glissez-déposez des fichiers ici
            </div>
          </div>
        )}
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
