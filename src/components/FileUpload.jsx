import { useRef, useState } from "react";
import { supabase } from "../supabase";
import Modal from "./Modal";

export default function FileUpload({ currentPath = "", onUpload }) {
  const [files, setFiles] = useState([]); // tableau de fichiers sélectionnés
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  // Modal création de dossier
  const [modalOpen, setModalOpen] = useState(false);
  const [folderName, setFolderName] = useState("");

  // Ouvre la modal
  const openCreateFolderModal = () => {
    setFolderName("");
    setModalOpen(true);
  };

  // Soumet la création du dossier
  const submitCreateFolder = async (e) => {
    e.preventDefault();
    if (!folderName) return;
    const folderPath =
      (currentPath ? currentPath + "/" : "") +
      folderName +
      "/.emptyFolderPlaceholder";
    const blob = new Blob([""], { type: "text/plain" });
    const { error } = await supabase.storage
      .from("files")
      .upload(folderPath, blob);
    setModalOpen(false);
    setFolderName("");
    if (!error) {
      onUpload && onUpload(currentPath);
    }
  };

  // File input/drag
  const handleChooseFile = () => fileInputRef.current.click();

  // Support multi-fichiers
  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files).map((file) => ({
      file,
      progress: 0,
      error: null,
      uploaded: false,
    }));
    setFiles((prev) => [...prev, ...selected]);
  };

  // Drag & drop depuis ordi (multi)
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).map((file) => ({
      file,
      progress: 0,
      error: null,
      uploaded: false,
    }));
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  // Upload tous les fichiers en parallèle
  const handleUploadAll = async () => {
    if (files.length === 0) return;
    setUploading(true);

    // On fait une copie du tableau pour gérer le state
    let newFiles = [...files];
    await Promise.all(
      newFiles.map(async (f, idx) => {
        const filename =
          (currentPath ? currentPath + "/" : "") +
          Date.now() +
          "_" +
          f.file.name;

        // Supabase JS ne fournit pas de hook progress natif,
        // on simule une progress bar (optimiste), sinon tu peux l'améliorer avec un vrai backend
        newFiles[idx].progress = 20;
        setFiles([...newFiles]);

        const { error } = await supabase.storage
          .from("files")
          .upload(filename, f.file);

        if (error) {
          newFiles[idx].error = error.message;
          newFiles[idx].progress = 100;
        } else {
          newFiles[idx].uploaded = true;
          newFiles[idx].progress = 100;
        }
        setFiles([...newFiles]);
      })
    );

    setUploading(false);
    setTimeout(() => setFiles([]), 1200); // Efface la liste après succès
    onUpload && onUpload(currentPath);
  };

  // Supprimer un fichier de la file avant upload
  const removeFile = (idx) => setFiles((f) => f.filter((_, i) => i !== idx));

  return (
    <div className="w-full flex flex-col items-center p-6 bg-blue-50 rounded-xl shadow space-y-4 border border-blue-100">
      <div
        className={`w-full flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-all py-8 cursor-pointer
          ${
            dragOver
              ? "border-blue-400 bg-blue-100"
              : "border-blue-200 bg-blue-50"
          }
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragOver(false);
        }}
        onDrop={handleDrop}
        onClick={handleChooseFile}
        title="Glissez-déposez ici ou cliquez pour choisir des fichiers"
      >
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <span className="text-3xl mb-2">⬇️</span>
        <div className="font-semibold text-amber-900 mb-1">
          Glissez-déposez <b>un ou plusieurs fichiers</b> ici
          <br />
          ou cliquez pour choisir
        </div>
        <div className="text-gray-500 text-sm">
          (dans “{currentPath || "dossier racine"}”)
        </div>
      </div>

      {/* Affichage files sélectionnés */}
      <div className="w-full">
        {files.length === 0 && (
          <div className="text-gray-400 italic text-center">
            Aucun fichier sélectionné
          </div>
        )}
        {files.map((f, idx) => (
          <div key={idx} className="flex items-center gap-2 mb-1 w-full">
            <span className="truncate flex-1">{f.file.name}</span>
            {f.error ? (
              <span className="text-xs text-red-600">{f.error}</span>
            ) : f.uploaded ? (
              <span className="text-green-600 text-xs">✔️ Uploadé</span>
            ) : uploading ? (
              <div className="flex-1 max-w-[180px] mr-2">
                <div className="w-full h-2 bg-gray-200 rounded">
                  <div
                    className="h-2 bg-gradient-to-r from-green-900 to-amber-900 rounded transition-all"
                    style={{ width: `${f.progress}%` }}
                  />
                </div>
              </div>
            ) : null}
            {!uploading && (
              <button
                className="text-xs text-red-600 hover:underline ml-2"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(idx);
                }}
              >
                Supprimer
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        className={`btn-primary w-full py-2 ${
          files.length === 0 || uploading ? "opacity-50 cursor-not-allowed" : ""
        }`}
        onClick={handleUploadAll}
        disabled={files.length === 0 || uploading}
      >
        {uploading ? "Upload en cours..." : "Uploader"}
      </button>

      {/* --- Modal Création de dossier --- */}
      <Modal
        open={modalOpen}
        title="Créer un dossier"
        onClose={() => setModalOpen(false)}
      >
        <form onSubmit={submitCreateFolder} className="space-y-3">
          <input
            className="input w-full"
            placeholder="Nom du dossier"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            autoFocus
            required
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="btn"
              onClick={() => setModalOpen(false)}
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
