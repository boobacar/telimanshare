import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import Modal from "./Modal";
import {
  CheckSquare,
  Square,
  FileText,
  Image as ImgIcon,
  Video,
  File as FileIcon,
  Folder as FolderIcon,
  Pencil,
  Trash2,
  Download,
  Info,
  Eye,
} from "lucide-react";

export default function FileTable({
  user,
  currentPath = "",
  onNavigate,
  refresh,
}) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(""); // "rename" | "delete" | "details"
  const [targetFile, setTargetFile] = useState(null);
  const [newName, setNewName] = useState("");

  // Preview modal
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    fetchFilesAndFolders();
    // eslint-disable-next-line
  }, [currentPath, refresh]);

  async function fetchFilesAndFolders() {
    setLoading(true);
    let { data, error } = await supabase.storage
      .from("files")
      .list(currentPath, {
        limit: 100,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) {
      setFiles([]);
      setFolders([]);
      setLoading(false);
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
            ? currentPath + "/" + file.name
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
    setLoading(false);
  }

  function getFileIcon(name) {
    if (name.match(/\.(jpg|jpeg|png|gif)$/i)) return <ImgIcon size={20} />;
    if (name.match(/\.(mp4|webm|mov)$/i)) return <Video size={20} />;
    if (name.match(/\.pdf$/i)) return <FileText size={20} />;
    return <FileIcon size={20} />;
  }
  function formatSize(s) {
    if (!s) return "—";
    s = Number(s);
    if (s > 1e6) return (s / 1e6).toFixed(2) + " Mo";
    if (s > 1e3) return (s / 1e3).toFixed(1) + " Ko";
    return s + " o";
  }
  function toggleSelect(file) {
    setSelected((sel) =>
      sel.includes(file.fullPath)
        ? sel.filter((f) => f !== file.fullPath)
        : [...sel, file.fullPath]
    );
  }
  function selectAll() {
    setSelected(files.map((f) => f.fullPath));
  }
  function unselectAll() {
    setSelected([]);
  }
  function isSelected(file) {
    return selected.includes(file.fullPath);
  }

  function openRename(file) {
    setModalType("rename");
    setTargetFile(file);
    setNewName(file.name.replace(/^\d+_/, ""));
    setModalOpen(true);
  }
  function openDelete(file) {
    setModalType("delete");
    setTargetFile(file);
    setModalOpen(true);
  }
  function openDetails(file) {
    setModalType("details");
    setTargetFile(file);
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setModalType("");
    setTargetFile(null);
    setNewName("");
  }

  // Aperçu
  function openPreview(file) {
    setPreviewFile(file);
    setPreviewOpen(true);
  }
  function closePreview() {
    setPreviewOpen(false);
    setPreviewFile(null);
  }

  // Rename
  async function handleRename(e) {
    e.preventDefault();
    if (!targetFile || !newName) return;
    const ext = targetFile.name.includes(".")
      ? "." + targetFile.name.split(".").pop()
      : "";
    const realNewName = newName.endsWith(ext) ? newName : newName + ext;
    const newPath = (currentPath ? currentPath + "/" : "") + realNewName;
    const { error: copyError } = await supabase.storage
      .from("files")
      .copy(targetFile.fullPath, newPath);
    if (!copyError) {
      await supabase.storage.from("files").remove([targetFile.fullPath]);
      fetchFilesAndFolders();
      closeModal();
    }
  }

  // Delete
  async function handleDelete() {
    if (!targetFile) return;
    const { error } = await supabase.storage
      .from("files")
      .remove([targetFile.fullPath]);
    if (!error) {
      fetchFilesAndFolders();
      closeModal();
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <button onClick={selectAll} className="btn px-2 flex items-center">
          <CheckSquare size={16} /> Tout sélectionner
        </button>
        <button onClick={unselectAll} className="btn px-2 flex items-center">
          <Square size={16} /> Désélectionner
        </button>
        <span className="text-xs text-gray-500">
          ({selected.length} sélectionné{selected.length > 1 ? "s" : ""})
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl shadow">
        <table className="w-full bg-white min-w-[600px]">
          <thead className="bg-blue-100 text-blue-900 font-semibold">
            <tr>
              <th className="py-2 px-3 w-12 text-center"></th>
              <th className="py-2 px-3 text-left">Type</th>
              <th className="py-2 px-3 text-left">Nom</th>
              <th className="py-2 px-3 text-left">Modifié par</th>
              <th className="py-2 px-3 text-left">Date</th>
              <th className="py-2 px-3 text-left">Taille</th>
              <th className="py-2 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {/* Dossiers */}
            {folders.map((folder) => {
              const full = currentPath
                ? `${currentPath}/${folder.name}`
                : folder.name;
              return (
                <tr
                  key={full}
                  className="hover:bg-blue-50 cursor-pointer"
                  onClick={() => onNavigate && onNavigate(full)}
                >
                  <td className="text-center">
                    <FolderIcon size={18} className="text-blue-600" />
                  </td>
                  <td className="font-medium text-blue-800">Dossier</td>
                  <td>{folder.name}</td>
                  <td>—</td>
                  <td>
                    {folder.updated_at
                      ? new Date(folder.updated_at).toLocaleString()
                      : "—"}
                  </td>
                  <td>—</td>
                  <td></td>
                </tr>
              );
            })}
            {/* Fichiers */}
            {files.map((file) => (
              <tr
                key={file.fullPath}
                className={`hover:bg-blue-50 ${
                  isSelected(file) ? "bg-blue-100" : ""
                }`}
              >
                {/* Checkbox */}
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={isSelected(file)}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleSelect(file);
                    }}
                    className="accent-amber-900"
                  />
                </td>
                {/* Icône */}
                <td>{getFileIcon(file.name)}</td>
                {/* Nom (click = preview) */}
                <td
                  className="font-medium text-gray-800 cursor-pointer"
                  onClick={() => openPreview(file)}
                >
                  {file.name.replace(/^\d+_/, "")}
                </td>
                {/* Propriétaire */}
                <td className="text-blue-700 text-sm">{file.owner}</td>
                {/* Date */}
                <td className="text-xs">
                  {file.updated_at
                    ? new Date(file.updated_at).toLocaleString()
                    : "—"}
                </td>
                {/* Taille */}
                <td>{formatSize(file.size)}</td>
                {/* Actions */}
                <td className="flex gap-1 justify-center">
                  <button
                    className="btn px-2"
                    title="Aperçu"
                    onClick={(e) => {
                      e.stopPropagation();
                      openPreview(file);
                    }}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className="btn px-2"
                    title="Télécharger"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const res = await fetch(file.url);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = file.name.replace(/^\d+_/, "");
                      document.body.appendChild(a);
                      a.click();
                      URL.revokeObjectURL(url);
                      a.remove();
                    }}
                  >
                    <Download size={16} />
                  </button>
                  <button
                    className="btn px-2"
                    title="Renommer"
                    onClick={(e) => {
                      e.stopPropagation();
                      openRename(file);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    className="btn px-2"
                    title="Supprimer"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDelete(file);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    className="btn px-2"
                    title="Détails"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetails(file);
                    }}
                  >
                    <Info size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {folders.length === 0 && files.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="text-center text-gray-400 py-8">
                  Aucun fichier ni dossier
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- MODAL PREVIEW --- */}
      <Modal
        open={previewOpen}
        title={
          previewFile?.name &&
          `Aperçu : ${previewFile.name.replace(/^\d+_/, "")}`
        }
        onClose={closePreview}
      >
        <div className="flex flex-col items-center">
          {previewFile?.name?.match(/\.(jpg|jpeg|png|gif)$/i) && (
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="max-h-[60vh] rounded shadow mb-2"
            />
          )}
          {previewFile?.name?.match(/\.pdf$/i) && (
            <iframe
              src={previewFile.url}
              title={previewFile.name}
              className="w-full max-w-lg h-[70vh] border rounded mb-2"
            />
          )}
          {previewFile?.name?.match(/\.(mp4|webm|mov)$/i) && (
            <video
              src={previewFile.url}
              controls
              className="w-full max-w-lg rounded shadow mb-2"
            />
          )}
          <div className="mt-3">
            <button
              className="btn-primary mt-4"
              onClick={async () => {
                const res = await fetch(previewFile.url);
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = previewFile.name.replace(/^\d+_/, "");
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                  window.URL.revokeObjectURL(url);
                  link.remove();
                }, 200);
              }}
            >
              Télécharger
            </button>
          </div>
        </div>
      </Modal>

      {/* --- MODALS --- */}
      <Modal
        open={modalOpen && modalType === "rename"}
        title="Renommer le fichier"
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
          <b>{targetFile?.name && targetFile.name.replace(/^\d+_/, "")}</b> ?
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
        open={modalOpen && modalType === "details"}
        title={
          targetFile?.name &&
          `Détails : ${targetFile.name.replace(/^\d+_/, "")}`
        }
        onClose={closeModal}
      >
        <div className="space-y-2">
          <div>
            <b>Nom :</b>{" "}
            {targetFile?.name && targetFile.name.replace(/^\d+_/, "")}
          </div>
          <div>
            <b>Taille :</b> {formatSize(targetFile?.size)}
          </div>
          <div>
            <b>Type :</b> {targetFile?.type || "—"}
          </div>
          <div>
            <b>Modifié par :</b> {targetFile?.owner || "—"}
          </div>
          <div>
            <b>Date :</b>{" "}
            {targetFile?.updated_at &&
              new Date(targetFile.updated_at).toLocaleString()}
          </div>
          <div className="mt-3">
            <button
              className="btn-primary"
              onClick={() => openPreview(targetFile)}
            >
              Ouvrir l’aperçu
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
