// src/components/SharePointTable.jsx
import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Modal from "./Modal";
import ToastLite from "./ToastLite";
import Comments from "./Comments";

import {
  Eye,
  Download,
  Pencil,
  Trash2,
  Folder as FolderIcon,
  File as FileIcon,
  FileText,
  Image as ImgIcon,
  Video,
  Share2,
  Link as LinkIcon,
  Copy as CopyIcon,
} from "lucide-react";

import {
  forceDownload,
  getPreviewUrl,
  kindFromName,
  createShareLink,
} from "../lib/supabaseStorage";

export default function SharePointTable({
  user,
  currentPath = "",
  onNavigate,
  refresh,
}) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState([]); // fullPaths

  // Modals génériques (rename/delete)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(""); // "rename" | "delete" | "delete-folder" | "rename-folder"
  const [target, setTarget] = useState(null); // file or folder
  const [newName, setNewName] = useState("");

  // Aperçu
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Partage
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [shareTTL, setShareTTL] = useState(86400); // 24h
  const [shareForceDownload, setShareForceDownload] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareLoading, setShareLoading] = useState(false);

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const showToast = (msg) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  useEffect(() => {
    fetchFilesAndFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, refresh]);

  async function fetchFilesAndFolders() {
    const { data, error } = await supabase.storage
      .from("files")
      .list(currentPath, {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      setFiles([]);
      setFolders([]);
      return;
    }

    setFolders(data.filter((item) => item.id === null));

    setFiles(
      data
        .filter(
          (item) => item.id !== null && item.name !== ".emptyFolderPlaceholder"
        )
        .map((file) => {
          const fullPath = currentPath
            ? `${currentPath}/${file.name}`
            : file.name;
          const { data: urlData } = supabase.storage
            .from("files")
            .getPublicUrl(fullPath);
          return {
            name: file.name,
            fullPath,
            url: urlData.publicUrl,
            updated_at: file.updated_at,
            size: file.metadata?.size || null,
            type: file.metadata?.mimetype || null,
            owner: file.metadata?.uploader || "—",
          };
        })
    );

    setSelected([]);
  }

  // UI helpers
  function getFileIcon(name) {
    if (name.match(/\.(jpg|jpeg|png|gif|webp|avif)$/i))
      return <ImgIcon size={18} />;
    if (name.match(/\.(mp4|webm|mov|m4v)$/i)) return <Video size={18} />;
    if (name.match(/\.pdf$/i)) return <FileText size={18} />;
    return <FileIcon size={18} />;
  }
  function formatSize(s) {
    if (!s) return "—";
    s = Number(s);
    if (s > 1e6) return (s / 1e6).toFixed(2) + " Mo";
    if (s > 1e3) return (s / 1e3).toFixed(1) + " Ko";
    return `${s} o`;
  }

  // --------- Aperçu ----------
  async function openPreview(file) {
    setPreviewFile(file);
    setPreviewUrl("");
    setPreviewOpen(true);
    try {
      const url = await getPreviewUrl(file.fullPath);
      setPreviewUrl(url);
    } catch (e) {
      console.error(e);
      showToast("Impossible d’ouvrir l’aperçu.");
    }
  }
  function closePreview() {
    setPreviewOpen(false);
    setPreviewFile(null);
    setPreviewUrl("");
  }

  // --------- Modals rename/delete ----------
  function openRename(file) {
    setModalType("rename");
    setTarget(file);
    setNewName(file.name.replace(/^\d+_/, ""));
    setModalOpen(true);
  }
  function openDelete(file) {
    setModalType("delete");
    setTarget(file);
    setModalOpen(true);
  }
  function openDeleteFolder(folder) {
    setModalType("delete-folder");
    setTarget(folder);
    setModalOpen(true);
  }
  function openRenameFolder(folder) {
    setModalType("rename-folder");
    setTarget(folder);
    setNewName(folder.name);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setModalType("");
    setTarget(null);
    setNewName("");
  }

  // --------- Sélection ----------
  function toggleSelect(item) {
    setSelected((sel) =>
      sel.includes(item.fullPath)
        ? sel.filter((f) => f !== item.fullPath)
        : [...sel, item.fullPath]
    );
  }
  function selectAll() {
    setSelected([
      ...folders.map((f) =>
        currentPath ? `${currentPath}/${f.name}` : f.name
      ),
      ...files.map((f) => f.fullPath),
    ]);
  }
  function unselectAll() {
    setSelected([]);
  }

  async function handleDeleteSelected() {
    if (!selected.length) return;
    if (!window.confirm(`Supprimer ${selected.length} élément(s) ?`)) return;
    await supabase.storage.from("files").remove(selected);
    setSelected([]);
    fetchFilesAndFolders();
    showToast("Éléments supprimés.");
  }

  // --------- Renommer / supprimer ----------
  async function handleRename(e) {
    e.preventDefault();
    if (!target || !newName) return;

    if (modalType === "rename") {
      const ext = target.name.includes(".")
        ? "." + target.name.split(".").pop()
        : "";
      const realNewName = newName.endsWith(ext) ? newName : newName + ext;
      const newPath = (currentPath ? currentPath + "/" : "") + realNewName;

      const { error: copyError } = await supabase.storage
        .from("files")
        .copy(target.fullPath, newPath);
      if (!copyError) {
        await supabase.storage.from("files").remove([target.fullPath]);
        fetchFilesAndFolders();
        closeModal();
        showToast("Nom modifié.");
      }
    } else if (modalType === "rename-folder") {
      const oldFolderPath = currentPath
        ? `${currentPath}/${target.name}`
        : target.name;
      const newFolderPath = currentPath ? `${currentPath}/${newName}` : newName;

      const { data, error } = await supabase.storage
        .from("files")
        .list(oldFolderPath, { limit: 1000, recursive: true });
      if (error) return showToast("Erreur de renommage.");

      for (const item of data) {
        if (item.id !== null) {
          const oldFilePath = `${oldFolderPath}/${item.name}`;
          const newFilePath = `${newFolderPath}/${item.name}`;
          await supabase.storage.from("files").copy(oldFilePath, newFilePath);
          await supabase.storage.from("files").remove([oldFilePath]);
        }
      }
      await supabase.storage
        .from("files")
        .copy(
          `${oldFolderPath}/.emptyFolderPlaceholder`,
          `${newFolderPath}/.emptyFolderPlaceholder`
        );
      await supabase.storage
        .from("files")
        .remove([`${oldFolderPath}/.emptyFolderPlaceholder`]);

      fetchFilesAndFolders();
      closeModal();
      showToast("Dossier renommé.");
    }
  }

  async function handleDelete() {
    if (!target) return;
    await supabase.storage.from("files").remove([target.fullPath]);
    fetchFilesAndFolders();
    closeModal();
    showToast("Fichier supprimé.");
  }

  async function handleDeleteFolder() {
    if (!target) return;
    const folderPath = currentPath
      ? `${currentPath}/${target.name}`
      : target.name;

    const { data, error } = await supabase.storage
      .from("files")
      .list(folderPath, { limit: 1000, recursive: true });
    if (error) return showToast("Erreur de suppression.");

    const filesToDelete = (data || [])
      .filter((item) => item.id !== null)
      .map((item) => `${folderPath}/${item.name}`);

    if (filesToDelete.length) {
      await supabase.storage.from("files").remove(filesToDelete);
    }
    await supabase.storage
      .from("files")
      .remove([`${folderPath}/.emptyFolderPlaceholder`]);

    fetchFilesAndFolders();
    closeModal();
    showToast("Dossier supprimé.");
  }

  // --------- Partage ----------
  function openShare(file) {
    setShareTarget(file);
    setShareTTL(86400);
    setShareForceDownload(false);
    setShareUrl("");
    setShareOpen(true);
  }
  function closeShare() {
    setShareOpen(false);
    setShareTarget(null);
    setShareUrl("");
  }
  async function handleGenerateShare() {
    if (!shareTarget) return;
    try {
      setShareLoading(true);
      const link = await createShareLink(shareTarget.fullPath, {
        ttlSeconds: Number(shareTTL),
        forceDownloadName: shareForceDownload
          ? shareTarget.name.replace(/^\d+_/, "")
          : undefined,
      });
      setShareUrl(link);
      showToast("Lien généré.");
    } catch (e) {
      console.error(e);
      showToast("Échec de génération du lien.");
    } finally {
      setShareLoading(false);
    }
  }
  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("Lien copié.");
    } catch {
      showToast("Copie impossible — sélectionnez manuellement.");
    }
  }

  // --------- Rendu ----------
  return (
    <>
      {/* Toast sobre */}
      <ToastLite
        open={toastOpen}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
      />

      {/* Barre d'actions groupées */}
      {selected.length > 0 && (
        <div className="flex items-center gap-4 mb-4 px-4 py-2 bg-white/70 rounded-xl shadow border border-gray-200">
          <span className="text-green-900 font-semibold text-base">
            <span className="bg-blue-50 rounded px-2 py-1">
              {selected.length}
            </span>{" "}
            sélectionné{selected.length > 1 ? "s" : ""}
          </span>
          <button
            className="flex items-center gap-2 bg-gray-100 text-gray-800 px-4 py-2 rounded-lg shadow-sm font-semibold border border-gray-300 hover:shadow-md active:scale-95"
            onClick={handleDeleteSelected}
          >
            <Trash2 size={19} className="text-red-500" />
            Supprimer
          </button>
          <button
            className="ml-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium border border-gray-200 shadow-sm"
            onClick={unselectAll}
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* Table desktop */}
      <div className="overflow-x-auto w-full hidden sm:block">
        <table className="w-full bg-white text-[15px] font-sans min-w-[560px]">
          <thead className="sticky top-0 bg-[#f3f2f1] text-[#323130] font-semibold border-b border-gray-200 z-10">
            <tr>
              <th className="py-2 px-2 w-9 text-left font-normal">
                <input
                  type="checkbox"
                  checked={
                    selected.length === folders.length + files.length &&
                    selected.length > 0
                  }
                  onChange={(e) =>
                    e.target.checked ? selectAll() : unselectAll()
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="accent-amber-900"
                />
              </th>
              <th className="py-2 px-2 text-left font-normal">Nom</th>
              <th className="py-2 px-2 text-left font-normal">Modifié</th>
              <th className="py-2 px-2 text-left font-normal hidden md:table-cell">
                Modifié par
              </th>
              <th className="py-2 px-2 text-left font-normal">Taille</th>
              <th className="py-2 px-2 text-center font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {/* Dossiers */}
            {folders.map((folder) => {
              const fullPath = currentPath
                ? `${currentPath}/${folder.name}`
                : folder.name;
              return (
                <tr
                  key={folder.name}
                  className="hover:bg-[#e5f1fb] border-b border-gray-100 transition"
                >
                  <td className="py-2 px-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(fullPath)}
                      onChange={() => toggleSelect({ fullPath })}
                      onClick={(e) => e.stopPropagation()}
                      className="accent-amber-900"
                    />
                  </td>
                  <td
                    className="py-2 px-2 flex items-center gap-2 font-semibold text-[#323130] cursor-pointer"
                    onClick={() => onNavigate && onNavigate(fullPath)}
                  >
                    <FolderIcon size={18} className="text-amber-900" />
                    <span>{folder.name}</span>
                  </td>
                  <td className="py-2 px-2 text-[#605e5c] text-sm">
                    {folder.updated_at
                      ? new Date(folder.updated_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="py-2 px-2 text-[#605e5c] text-sm hidden md:table-cell">
                    —
                  </td>
                  <td className="py-2 px-2 text-[#605e5c] text-sm">—</td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex gap-2">
                      <button
                        className="hover:text-amber-900"
                        title="Renommer"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRenameFolder(folder);
                        }}
                      >
                        <Pencil size={17} />
                      </button>
                      <button
                        className="hover:text-red-600"
                        title="Supprimer"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteFolder(folder);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Fichiers */}
            {files.map((file) => (
              <tr
                key={file.fullPath}
                className="group hover:bg-[#e5f1fb] border-b border-gray-100 transition cursor-pointer"
                onClick={() => openPreview(file)}
              >
                <td className="py-2 px-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(file.fullPath)}
                    onChange={() => toggleSelect(file)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-amber-900"
                  />
                </td>
                <td className="py-2 px-2 flex items-center gap-2 font-semibold text-[#323130]">
                  <span>{getFileIcon(file.name)}</span>
                  <span>{file.name.replace(/^\d+_/, "")}</span>
                </td>
                <td className="py-2 px-2 text-[#605e5c] text-sm">
                  {file.updated_at
                    ? new Date(file.updated_at).toLocaleDateString()
                    : "—"}
                </td>
                <td className="py-2 px-2 text-[#605e5c] text-sm hidden md:table-cell">
                  {file.owner}
                </td>
                <td className="py-2 px-2 text-[#605e5c] text-sm">
                  {formatSize(file.size)}
                </td>
                <td className="py-2 px-2 text-right">
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                    <button
                      className="hover:text-amber-900"
                      title="Aperçu"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPreview(file);
                      }}
                    >
                      <Eye size={17} />
                    </button>
                    <button
                      title="Télécharger"
                      className="hover:text-amber-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        forceDownload(
                          file.fullPath,
                          file.name.replace(/^\d+_/, "")
                        );
                      }}
                    >
                      <Download size={17} />
                    </button>
                    <button
                      title="Partager"
                      className="hover:text-amber-900"
                      onClick={(e) => {
                        e.stopPropagation();
                        openShare(file);
                      }}
                    >
                      <Share2 size={17} />
                    </button>
                    <button
                      className="hover:text-amber-900"
                      title="Renommer"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRename(file);
                      }}
                    >
                      <Pencil size={17} />
                    </button>
                    <button
                      className="hover:text-red-600"
                      title="Supprimer"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDelete(file);
                      }}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {folders.length === 0 && files.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8">
                  Aucun fichier ni dossier
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Liste mobile (simple) */}
      <ul className="sm:hidden flex flex-col gap-1">
        {folders.map((folder) => {
          const fullPath = currentPath
            ? `${currentPath}/${folder.name}`
            : folder.name;
          return (
            <li
              key={folder.name}
              className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-200"
            >
              <input
                type="checkbox"
                checked={selected.includes(fullPath)}
                onChange={() => toggleSelect({ fullPath })}
                onClick={(e) => e.stopPropagation()}
                className="accent-amber-900 mr-1"
              />
              <button onClick={() => onNavigate && onNavigate(fullPath)}>
                <FolderIcon size={20} className="text-amber-900" />
              </button>
              <div
                className="flex-1 font-semibold truncate"
                onClick={() => onNavigate && onNavigate(fullPath)}
              >
                {folder.name}
              </div>
              <button
                className="text-gray-400 hover:text-amber-900 px-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openRenameFolder(folder);
                }}
              >
                <Pencil size={18} />
              </button>
              <button
                className="text-gray-400 hover:text-red-600 px-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openDeleteFolder(folder);
                }}
              >
                <Trash2 size={18} />
              </button>
            </li>
          );
        })}
        {files.map((file) => (
          <li
            key={file.fullPath}
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-200"
            onClick={() => openPreview(file)}
          >
            <input
              type="checkbox"
              checked={selected.includes(file.fullPath)}
              onChange={() => toggleSelect(file)}
              onClick={(e) => e.stopPropagation()}
              className="accent-amber-900 mr-1"
            />
            <span>{getFileIcon(file.name)}</span>
            <div className="flex-1 font-semibold truncate">
              {file.name.replace(/^\d+_/, "")}
            </div>
            <button
              className="text-gray-400 hover:text-amber-900 px-1"
              onClick={(e) => {
                e.stopPropagation();
                openPreview(file);
              }}
            >
              <Eye size={18} />
            </button>
            <button
              className="text-gray-400 hover:text-amber-900 px-1"
              onClick={(e) => {
                e.stopPropagation();
                forceDownload(file.fullPath, file.name.replace(/^\d+_/, ""));
              }}
            >
              <Download size={18} />
            </button>
          </li>
        ))}
      </ul>

      {/* --------- MODAL APERÇU + COMMENTAIRES ---------- */}
      <Modal
        open={previewOpen}
        title={
          previewFile?.name &&
          `Aperçu : ${previewFile.name.replace(/^\d+_/, "")}`
        }
        onClose={closePreview}
        size="xl"
        bodyClassName="p-0" // on gère les marges à l'intérieur
      >
        {/* Zone d'aperçu scrollable dans le modal */}
        <div className="w-full">
          {/* Wrapper qui contrôle la hauteur d’aperçu et le scroll */}
          <div className="w-full max-w-3xl mx-auto p-4">
            <div className="w-full h-[60vh] md:h-[70vh] border rounded-lg bg-white overflow-hidden">
              <div className="w-full h-full overflow-auto flex items-center justify-center">
                {/* IMAGE */}
                {previewFile &&
                  kindFromName(previewFile.name) === "image" &&
                  previewUrl && (
                    <img
                      src={previewUrl}
                      alt={previewFile.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  )}

                {/* PDF */}
                {previewFile &&
                  kindFromName(previewFile.name) === "pdf" &&
                  previewUrl && (
                    <iframe
                      src={previewUrl}
                      title={previewFile.name}
                      className="w-full h-full"
                    />
                  )}

                {/* VIDÉO */}
                {previewFile &&
                  kindFromName(previewFile.name) === "video" &&
                  previewUrl && (
                    <video
                      src={previewUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}

                {/* OFFICE / AUTRES via Google Viewer */}
                {previewFile &&
                  (kindFromName(previewFile.name) === "office" ||
                    kindFromName(previewFile.name) === "other") &&
                  previewUrl && (
                    <iframe
                      title={previewFile.name}
                      className="w-full h-full"
                      src={`https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
                        previewUrl
                      )}`}
                    />
                  )}

                {/* Fallback si pas d’URL */}
                {!previewUrl && (
                  <div className="text-gray-400 text-sm">
                    Chargement de l’aperçu…
                  </div>
                )}
              </div>
            </div>

            {/* Boutons actions */}
            <div className="mt-3 flex gap-2">
              <button
                className="btn-primary"
                onClick={() =>
                  forceDownload(
                    previewFile.fullPath,
                    previewFile.name.replace(/^\d+_/, "")
                  )
                }
              >
                Télécharger
              </button>
              <button className="btn" onClick={() => openShare(previewFile)}>
                <Share2 size={16} className="inline mr-1" />
                Partager
              </button>
            </div>

            {/* Commentaires */}
            {previewFile?.fullPath && (
              <div className="mt-6">
                <Comments filePath={previewFile.fullPath} user={user} />
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* --------- MODALS RENAME / DELETE ---------- */}
      <Modal
        open={
          modalOpen && (modalType === "rename" || modalType === "rename-folder")
        }
        title={
          modalType === "rename-folder"
            ? "Renommer le dossier"
            : "Renommer le fichier"
        }
        onClose={closeModal}
      >
        <form onSubmit={handleRename} className="space-y-3">
          <input
            className="input w-full"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
          />
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn" onClick={closeModal}>
              Annuler
            </button>
            <button type="submit" className="btn-primary">
              Renommer
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={modalOpen && modalType === "delete"}
        title="Supprimer le fichier"
        onClose={closeModal}
      >
        <div className="mb-3 text-sm">
          Voulez-vous vraiment supprimer le fichier{" "}
          <b>{target?.name && target.name.replace(/^\d+_/, "")}</b> ?
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={closeModal}>
            Annuler
          </button>
          <button
            className="btn-primary bg-red-600 hover:bg-red-700"
            onClick={handleDelete}
          >
            Supprimer
          </button>
        </div>
      </Modal>

      <Modal
        open={modalOpen && modalType === "delete-folder"}
        title="Supprimer le dossier"
        onClose={closeModal}
      >
        <div className="mb-3 text-sm">
          Voulez-vous vraiment supprimer le dossier <b>{target?.name}</b> et
          tout son contenu ?
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={closeModal}>
            Annuler
          </button>
          <button
            className="btn-primary bg-red-600 hover:bg-red-700"
            onClick={handleDeleteFolder}
          >
            Supprimer
          </button>
        </div>
      </Modal>

      {/* --------- MODAL PARTAGE ---------- */}
      <Modal
        open={shareOpen}
        title={`Partager : ${shareTarget?.name?.replace(/^\d+_/, "") || ""}`}
        onClose={closeShare}
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-700">
            Générez un lien temporaire. Toute personne avec ce lien pourra{" "}
            <b>voir</b> et <b>télécharger</b> le fichier pendant la durée
            choisie.
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm">Durée :</label>
            <select
              className="input"
              value={shareTTL}
              onChange={(e) => setShareTTL(e.target.value)}
            >
              <option value={3600}>1 heure</option>
              <option value={86400}>24 heures</option>
              <option value={604800}>7 jours</option>
              <option value={2592000}>30 jours</option>
            </select>

            <label className="flex items-center gap-2 text-sm ml-2">
              <input
                type="checkbox"
                checked={shareForceDownload}
                onChange={(e) => setShareForceDownload(e.target.checked)}
              />
              Forcer le téléchargement
            </label>

            <button
              className="btn-primary ml-auto"
              onClick={handleGenerateShare}
              disabled={shareLoading || !shareTarget}
            >
              {shareLoading ? "Génération…" : "Générer le lien"}
            </button>
          </div>

          {shareUrl && (
            <div className="flex items-center gap-2">
              <LinkIcon size={18} className="text-blue-600" />
              <input
                className="input flex-1"
                value={shareUrl}
                readOnly
                onFocus={(e) => e.target.select()}
              />
              <button className="btn" onClick={copyShareUrl} title="Copier">
                <CopyIcon size={16} />
              </button>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Conseil : envoyez ce lien par email/WhatsApp. À expiration, il ne
            fonctionnera plus.
          </div>
        </div>
      </Modal>
    </>
  );
}
