// src/components/SharePointTable.jsx
import { useEffect, useState } from "react";
import { db, storage } from "../firebase";
import {
  ref as sRef,
  listAll,
  getMetadata,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";

import Modal from "./Modal";
import ToastLite from "./ToastLite";
import Comments from "./Comments";

import {
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
  Shield,
} from "lucide-react";

/* ---------- Helpers ---------- */
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
function kindFromName(name) {
  if (/\.(jpg|jpeg|png|gif|webp|avif)$/i.test(name)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/i.test(name)) return "video";
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.(docx?|xlsx?|pptx?)$/i.test(name)) return "office";
  return "other";
}
function formatSize(s) {
  if (!s) return "—";
  s = Number(s);
  if (s > 1e6) return (s / 1e6).toFixed(2) + " Mo";
  if (s > 1e3) return (s / 1e3).toFixed(1) + " Ko";
  return `${s} o`;
}
async function isAdminEmail(email) {
  if (!email) return false;
  const snap = await getDoc(doc(db, "admins", email.toLowerCase()));
  return snap.exists();
}
async function fetchMeta(path) {
  const id = base64url(normalizeKey(path));
  const snap = await getDoc(doc(db, "metas", id));
  return snap.exists() ? snap.data() : null;
}
async function getEffectiveMeta(path, cache) {
  const exact = normalizeKey(path);
  if (cache.has(exact)) return cache.get(exact);

  let m = await fetchMeta(exact);
  if (m) {
    cache.set(exact, m);
    return m;
  }

  const parts = exact.endsWith("/")
    ? exact.slice(0, -1).split("/")
    : exact.split("/");

  for (let last = parts.length - 2; last >= 0; last--) {
    const parent = parts.slice(0, last + 1).join("/") + "/";
    if (cache.has(parent)) {
      const mm = cache.get(parent);
      cache.set(exact, mm);
      return mm;
    }
    const snap = await fetchMeta(parent);
    if (snap) {
      cache.set(parent, snap);
      cache.set(exact, snap);
      return snap;
    }
    cache.set(parent, null);
  }
  cache.set(exact, null);
  return null;
}
function canUserRead(meta, me, isAdmin) {
  if (!meta) return false;
  if (meta.is_public) return true;
  if (isAdmin) return true;
  if (!me) return false;
  if (meta.owner_email && meta.owner_email.toLowerCase() === me) return true;
  if (Array.isArray(meta.allowed_emails)) {
    return meta.allowed_emails.map((e) => e?.toLowerCase?.() || e).includes(me);
  }
  return false;
}
function canUserManage(meta, me, isAdmin) {
  // Politique demandée: SEUL l'admin peut gérer
  return !!isAdmin;
}

/* ---------- Composant ---------- */
export default function SharePointTable({
  user,
  currentPath = "",
  onNavigate,
  refresh,
}) {
  const me = (user?.email || "").toLowerCase();

  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  const [metaCache] = useState(() => new Map());
  const [isAdmin, setIsAdmin] = useState(false);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [target, setTarget] = useState(null);
  const [newName, setNewName] = useState("");

  // Aperçu
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  // Partage
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [shareUrl, setShareUrl] = useState("");

  // Accès
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null);
  const [accessPublic, setAccessPublic] = useState(false);
  const [accessEmails, setAccessEmails] = useState("");
  const [accessIsFolder, setAccessIsFolder] = useState(false);

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const showToast = (msg) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const admin = await isAdminEmail(me);
      if (!alive) return;
      setIsAdmin(admin);
      await fetchFilesAndFolders(admin);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, refresh, me]);

  /** =========================================================
   *  FETCH plus RAPIDE :
   *  - getMetadata() en PARALLÈLE via Promise.allSettled
   *  - contrôle des accès en PARALLÈLE sur dossiers & fichiers
   *  ========================================================= */
  async function fetchFilesAndFolders(adminFlag) {
    setLoading(true);
    setFiles([]);
    setFolders([]);
    setSelected([]);

    const prefix = currentPath ? currentPath + "/" : "";
    const res = await listAll(sRef(storage, "files/" + prefix));

    // Dossiers
    const nextFolders = res.prefixes.map((p) => ({
      name: p.name,
      fullPath: (currentPath ? currentPath + "/" : "") + p.name,
    }));

    // Fichiers : métadonnées en // (bien plus rapide que await dans une boucle)
    const metaPromises = res.items
      .filter((it) => it.name !== ".emptyFolderPlaceholder")
      .map(async (itemRef) => {
        const [meta] = await Promise.all([getMetadata(itemRef)]);
        const fullPathRel = (itemRef.fullPath || "").replace(/^files\//, "");
        return {
          name: itemRef.name,
          fullPath: fullPathRel,
          updated_at: meta.updated || meta.timeCreated,
          size: meta.size || null,
          type: meta.contentType || null,
          owner: meta.customMetadata?.owner_email || "—",
        };
      });

    const fileObjs = (await Promise.allSettled(metaPromises))
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    // Contrôles d'accès en //
    const folderChecks = await Promise.all(
      nextFolders.map(async (d) => {
        const eff = await getEffectiveMeta(d.fullPath + "/", metaCache);
        return canUserRead(eff, me, adminFlag) ? d : null;
      })
    );
    const fileChecks = await Promise.all(
      fileObjs.map(async (f) => {
        const eff = await getEffectiveMeta(f.fullPath, metaCache);
        return canUserRead(eff, me, adminFlag) ? f : null;
      })
    );

    setFolders(folderChecks.filter(Boolean));
    setFiles(fileChecks.filter(Boolean));
    setLoading(false);
  }

  // Aperçu
  async function openPreview(file) {
    const eff = await getEffectiveMeta(file.fullPath, metaCache);
    if (!canUserRead(eff, me, isAdmin)) {
      showToast("Accès refusé.");
      return;
    }
    setPreviewFile(file);
    setPreviewUrl("");
    setPreviewOpen(true);
    try {
      const url = await getDownloadURL(sRef(storage, "files/" + file.fullPath));
      setPreviewUrl(url);
    } catch {
      showToast("Impossible d’ouvrir l’aperçu.");
    }
  }
  function closePreview() {
    setPreviewOpen(false);
    setPreviewFile(null);
    setPreviewUrl("");
  }

  // Sélection (admin uniquement)
  function toggleSelect(item) {
    if (!isAdmin) return;
    setSelected((sel) =>
      sel.includes(item.fullPath)
        ? sel.filter((f) => f !== item.fullPath)
        : [...sel, item.fullPath]
    );
  }
  function selectAll() {
    if (!isAdmin) return;
    setSelected([
      ...folders.map((f) =>
        currentPath ? `${currentPath}/${f.name}` : f.name
      ),
      ...files.map((f) => f.fullPath),
    ]);
  }
  function unselectAll() {
    if (!isAdmin) return;
    setSelected([]);
  }

  async function handleDeleteSelected() {
    if (!isAdmin) return;
    if (!selected.length) return;
    if (!window.confirm(`Supprimer ${selected.length} élément(s) ?`)) return;
    for (const p of selected) {
      try {
        await deleteObject(sRef(storage, "files/" + p));
        await deleteDoc(doc(db, "metas", base64url(normalizeKey(p))));
      } catch {}
    }
    setSelected([]);
    fetchFilesAndFolders(isAdmin);
    showToast("Éléments supprimés.");
  }

  // Gestions protégées (admin only)
  function openRename(file) {
    if (!isAdmin) return showToast("Réservé aux admins.");
    setModalType("rename");
    setTarget(file);
    setNewName(file.name.replace(/^\d+_/, ""));
    setModalOpen(true);
  }
  function openDelete(file) {
    if (!isAdmin) return showToast("Réservé aux admins.");
    setModalType("delete");
    setTarget(file);
    setModalOpen(true);
  }
  function openDeleteFolder(folder) {
    if (!isAdmin) return showToast("Réservé aux admins.");
    setModalType("delete-folder");
    setTarget(folder);
    setModalOpen(true);
  }
  function openRenameFolder(folder) {
    if (!isAdmin) return showToast("Réservé aux admins.");
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

  async function handleDelete() {
    if (!isAdmin || !target) return;
    try {
      await deleteObject(sRef(storage, "files/" + target.fullPath));
      await deleteDoc(
        doc(db, "metas", base64url(normalizeKey(target.fullPath)))
      );
    } catch {}
    fetchFilesAndFolders(isAdmin);
    closeModal();
    showToast("Fichier supprimé.");
  }

  async function handleDeleteFolder() {
    if (!isAdmin || !target) return;
    const folderPath = currentPath
      ? `${currentPath}/${target.name}/`
      : `${target.name}/`;
    try {
      await deleteObject(
        sRef(storage, "files/" + folderPath + ".emptyFolderPlaceholder")
      );
    } catch {}
    try {
      await deleteDoc(doc(db, "metas", base64url(normalizeKey(folderPath))));
    } catch {}
    fetchFilesAndFolders(isAdmin);
    closeModal();
    showToast("Dossier supprimé.");
  }

  // Partage (admin only)
  function openShare(file) {
    if (!isAdmin) return showToast("Réservé aux admins.");
    setShareTarget(file);
    setShareUrl("");
    setShareOpen(true);
    getDownloadURL(sRef(storage, "files/" + file.fullPath)).then(setShareUrl);
  }
  function closeShare() {
    setShareOpen(false);
    setShareTarget(null);
    setShareUrl("");
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

  // Accès (admin only)
  async function openAccessFile(file) {
    if (!isAdmin) return showToast("Réservé aux admins.");
    const eff = await getEffectiveMeta(file.fullPath, metaCache);
    if (!canUserManage(eff, me, isAdmin)) {
      showToast("Réservé aux admins.");
      return;
    }
    const own = eff || {};
    setAccessTarget({ ...file });
    setAccessIsFolder(false);
    setAccessPublic(!!own.is_public);
    setAccessEmails((own.allowed_emails || []).join(", "));
    setAccessOpen(true);
  }
  async function openAccessFolder(folder) {
    if (!isAdmin) return showToast("Réservé aux admins.");
    const folderKey = currentPath
      ? `${currentPath}/${folder.name}/`
      : `${folder.name}/`;
    const eff = await getEffectiveMeta(folderKey, metaCache);
    if (!canUserManage(eff, me, isAdmin)) {
      showToast("Réservé aux admins.");
      return;
    }
    const own = eff || {};
    setAccessTarget({ name: folder.name, fullPath: folderKey });
    setAccessIsFolder(true);
    setAccessPublic(!!own.is_public);
    setAccessEmails((own.allowed_emails || []).join(", "));
    setAccessOpen(true);
  }
  function closeAccess() {
    setAccessOpen(false);
    setAccessTarget(null);
    setAccessEmails("");
    setAccessPublic(false);
    setAccessIsFolder(false);
  }
  async function saveAccess() {
    if (!isAdmin || !accessTarget) return;
    const path = normalizeKey(accessTarget.fullPath);
    const metaId = base64url(path);
    const payload = {
      file_path: path,
      is_public: accessPublic,
      allowed_emails: accessEmails
        .split(/[,\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
      owner_email: (await getEffectiveMeta(path, metaCache))?.owner_email || me,
      updated_at: serverTimestamp(),
    };
    await setDoc(doc(db, "metas", metaId), payload, { merge: true });
    metaCache.set(path, payload);
    showToast("Accès mis à jour.");
    closeAccess();
  }

  async function forceDownload(fullPath, name) {
    const url = await getDownloadURL(sRef(storage, "files/" + fullPath));
    const a = document.createElement("a");
    a.href = url;
    a.download = name || fullPath.split("/").pop();
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ===================== RENDER ===================== */
  return (
    <>
      <ToastLite
        open={toastOpen}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
      />

      {/* BARRE D’ACTIONS MULTI-SÉLECTION — Admin uniquement */}
      {isAdmin && selected.length > 0 && (
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
            <Trash2 size={19} className="text-red-500" /> Supprimer
          </button>
          <button
            className="ml-1 px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium border border-gray-200 shadow-sm"
            onClick={unselectAll}
          >
            Tout désélectionner
          </button>
        </div>
      )}

      {/* ========= TABLE DESKTOP ========= */}
      <div className="w-full overflow-x-auto hidden sm:block">
        <table className="w-full bg-white text-[15px] font-sans min-w-[720px] table-fixed">
          <thead className="sticky top-0 bg-[#f3f2f1] text-[#323130] font-semibold border-b border-gray-200 z-10">
            <tr>
              <th className="py-2 px-2 w-9 text-left font-normal">
                {isAdmin ? (
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
                ) : (
                  <span className="inline-block w-4" />
                )}
              </th>
              <th className="py-2 px-2 text-left font-normal w-auto">
                <span className="block truncate">Nom</span>
              </th>
              <th className="py-2 px-2 text-left font-normal w-32 whitespace-nowrap">
                Date
              </th>
              <th className="py-2 px-2 text-left font-normal w-40 whitespace-nowrap hidden md:table-cell">
                Ajouté par
              </th>
              <th className="py-2 px-2 text-left font-normal w-24 whitespace-nowrap">
                Taille
              </th>
              <th className="py-2 px-2 text-center font-normal w-28"></th>
            </tr>
          </thead>

          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-gray-400">
                  Chargement…
                </td>
              </tr>
            )}

            {/* Dossiers */}
            {!loading &&
              folders.map((folder) => {
                const fullPath = currentPath
                  ? `${currentPath}/${folder.name}`
                  : folder.name;
                return (
                  <tr
                    key={`folder-${fullPath}`}
                    className="hover:bg-[#e5f1fb] border-b border-gray-100 transition"
                  >
                    <td className="py-2 px-2 align-middle">
                      {isAdmin ? (
                        <input
                          type="checkbox"
                          checked={selected.includes(fullPath)}
                          onChange={() => toggleSelect({ fullPath })}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-amber-900"
                        />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </td>
                    <td className="py-2 px-2 align-middle max-w-0">
                      <button
                        className="flex items-center gap-2 font-semibold text-[#323130] w-full min-w-0"
                        onClick={() => onNavigate && onNavigate(fullPath)}
                        title={folder.name}
                      >
                        <FolderIcon
                          size={18}
                          className="text-amber-900 shrink-0"
                        />
                        <span className="truncate">{folder.name}</span>
                      </button>
                    </td>
                    <td className="py-2 px-2 text-[#605e5c] text-sm whitespace-nowrap align-middle">
                      —
                    </td>
                    <td className="py-2 px-2 text-[#605e5c] text-sm whitespace-nowrap hidden md:table-cell align-middle">
                      —
                    </td>
                    <td className="py-2 px-2 text-[#605e5c] text-sm whitespace-nowrap align-middle">
                      —
                    </td>
                    <td className="py-2 px-2 text-right align-middle">
                      {isAdmin ? (
                        <div className="flex gap-2 justify-end">
                          <button
                            className="hover:text-amber-900"
                            title="Accès"
                            onClick={(e) => {
                              e.stopPropagation();
                              openAccessFolder(folder);
                            }}
                          >
                            <Shield size={17} />
                          </button>
                          {/* Bouton Modifier retiré pour tout le monde */}
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
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </td>
                  </tr>
                );
              })}

            {/* Fichiers */}
            {!loading &&
              files.map((file) => {
                return (
                  <tr
                    key={file.fullPath}
                    className="group hover:bg-[#e5f1fb] border-b border-gray-100 transition"
                  >
                    <td className="py-2 px-2 align-middle">
                      {isAdmin ? (
                        <input
                          type="checkbox"
                          checked={selected.includes(file.fullPath)}
                          onChange={() => toggleSelect(file)}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-amber-900"
                        />
                      ) : (
                        <span className="inline-block w-4" />
                      )}
                    </td>
                    <td className="py-2 px-2 max-w-0 align-middle">
                      <div className="flex items-center gap-2 font-semibold text-[#323130] w-full min-w-0">
                        <span className="shrink-0">
                          {kindFromName(file.name) === "image" ? (
                            <ImgIcon size={18} />
                          ) : kindFromName(file.name) === "video" ? (
                            <Video size={18} />
                          ) : kindFromName(file.name) === "pdf" ? (
                            <FileText size={18} />
                          ) : (
                            <FileIcon size={18} />
                          )}
                        </span>
                        <button
                          className="truncate text-left w-full"
                          title={file.name}
                          onClick={() => openPreview(file)}
                        >
                          {file.name.replace(/^\d+_/, "")}
                        </button>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-[#605e5c] text-sm whitespace-nowrap align-middle">
                      {file.updated_at
                        ? new Date(file.updated_at).toLocaleDateString()
                        : "—"}
                    </td>
                    <td className="py-2 px-2 text-[#605e5c] text-sm whitespace-nowrap hidden md:table-cell align-middle">
                      {file.owner}
                    </td>
                    <td className="py-2 px-2 text-[#605e5c] text-sm whitespace-nowrap align-middle">
                      {formatSize(file.size)}
                    </td>
                    <td className="py-2 px-2 align-middle">
                      <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition">
                        {/* Bouton Aperçu retiré (clic sur le nom = aperçu) */}

                        <button
                          className="hover:text-amber-900"
                          title="Télécharger"
                          onClick={() =>
                            forceDownload(
                              file.fullPath,
                              file.name.replace(/^\d+_/, "")
                            )
                          }
                        >
                          <Download size={17} />
                        </button>

                        {/* Boutons admin uniquement — pas de bouton Modifier */}
                        {isAdmin && (
                          <>
                            <button
                              className="hover:text-amber-900"
                              title="Partager"
                              onClick={() => openShare(file)}
                            >
                              <Share2 size={17} />
                            </button>
                            <button
                              className="hover:text-amber-900"
                              title="Accès"
                              onClick={() => openAccessFile(file)}
                            >
                              <Shield size={17} />
                            </button>
                            <button
                              className="hover:text-red-600"
                              title="Supprimer"
                              onClick={() => openDelete(file)}
                            >
                              <Trash2 size={17} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

            {/* Vide */}
            {!loading && folders.length === 0 && files.length === 0 && (
              <tr>
                <td colSpan={6} className="py-16">
                  <div className="flex flex-col items-center justify-center text-gray-500">
                    <div className="text-lg font-semibold">
                      Aucun dossier ou fichier
                    </div>
                    <div className="text-sm">
                      Ajoutez des éléments avec “Ajouter un/des fichier(s)” ou
                      “Créer un dossier”.
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ========= LISTE MOBILE ========= */}
      <ul className="sm:hidden flex flex-col gap-2 mt-2">
        {loading && (
          <li className="text-center text-gray-400 py-6">Chargement…</li>
        )}

        {!loading &&
          folders.map((folder) => {
            const fullPath = currentPath
              ? `${currentPath}/${folder.name}`
              : folder.name;
            return (
              <li
                key={"m-" + fullPath}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-200 min-w-0"
              >
                {isAdmin ? (
                  <input
                    type="checkbox"
                    checked={selected.includes(fullPath)}
                    onChange={() => toggleSelect({ fullPath })}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-amber-900 mr-1 shrink-0"
                  />
                ) : (
                  <span className="inline-block w-4" />
                )}

                <button onClick={() => onNavigate && onNavigate(fullPath)}>
                  <FolderIcon size={20} className="text-amber-900" />
                </button>
                <button
                  className="flex-1 font-semibold truncate text-left min-w-0"
                  onClick={() => onNavigate && onNavigate(fullPath)}
                  title={folder.name}
                >
                  {folder.name}
                </button>

                {isAdmin && (
                  <>
                    <button
                      className="text-gray-400 hover:text-amber-900 px-1 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAccessFolder(folder);
                      }}
                      title="Accès"
                    >
                      <Shield size={18} />
                    </button>
                    {/* Modifier retiré */}
                    <button
                      className="text-gray-400 hover:text-red-600 px-1 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteFolder(folder);
                      }}
                      title="Supprimer"
                    >
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </li>
            );
          })}

        {!loading &&
          files.map((file) => {
            return (
              <li
                key={"m-" + file.fullPath}
                className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white shadow-sm border border-gray-200 min-w-0"
              >
                {isAdmin ? (
                  <input
                    type="checkbox"
                    checked={selected.includes(file.fullPath)}
                    onChange={() => toggleSelect(file)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-amber-900 mr-1 shrink-0"
                  />
                ) : (
                  <span className="inline-block w-4" />
                )}

                <span className="shrink-0">
                  {kindFromName(file.name) === "image" ? (
                    <ImgIcon size={18} />
                  ) : kindFromName(file.name) === "video" ? (
                    <Video size={18} />
                  ) : kindFromName(file.name) === "pdf" ? (
                    <FileText size={18} />
                  ) : (
                    <FileIcon size={18} />
                  )}
                </span>
                <button
                  className="flex-1 font-semibold truncate text-left min-w-0"
                  title={file.name}
                  onClick={() => openPreview(file)}
                >
                  {file.name.replace(/^\d+_/, "")}
                </button>

                <button
                  className="text-gray-400 hover:text-amber-900 px-1 shrink-0"
                  onClick={() =>
                    forceDownload(file.fullPath, file.name.replace(/^\d+_/, ""))
                  }
                  title="Télécharger"
                >
                  <Download size={18} />
                </button>

                {isAdmin && (
                  <>
                    <button
                      className="text-gray-400 hover:text-amber-900 px-1 shrink-0"
                      onClick={() => openShare(file)}
                      title="Partager"
                    >
                      <Share2 size={18} />
                    </button>
                    <button
                      className="text-gray-400 hover:text-amber-900 px-1 shrink-0"
                      onClick={() => openAccessFile(file)}
                      title="Accès"
                    >
                      <Shield size={18} />
                    </button>
                  </>
                )}
              </li>
            );
          })}

        {!loading && folders.length === 0 && files.length === 0 && (
          <li className="text-center text-gray-500 py-10">
            Aucun dossier ou fichier
          </li>
        )}
      </ul>

      {/* ========= MODALS ========= */}
      <Modal
        open={previewOpen}
        title={
          previewFile?.name &&
          `Aperçu : ${previewFile.name.replace(/^\d+_/, "")}`
        }
        onClose={closePreview}
        size="xl"
        bodyClassName="p-0"
      >
        <div className="w-full">
          <div className="w-full max-w-3xl mx-auto p-4">
            <div className="w-full h-[60vh] md:h-[70vh] border rounded-lg bg-white overflow-hidden">
              <div className="w-full h-full overflow-auto flex items-center justify-center">
                {previewFile &&
                  kindFromName(previewFile.name) === "image" &&
                  previewUrl && (
                    <img
                      src={previewUrl}
                      alt={previewFile.name}
                      className="max-w-full max-h-full object-contain"
                    />
                  )}
                {previewFile &&
                  kindFromName(previewFile.name) === "pdf" &&
                  previewUrl && (
                    <iframe
                      src={previewUrl}
                      title={previewFile.name}
                      className="w-full h-full"
                    />
                  )}
                {previewFile &&
                  kindFromName(previewFile.name) === "video" &&
                  previewUrl && (
                    <video
                      src={previewUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  )}
                {previewFile &&
                  kindFromName(previewFile.name) === "office" &&
                  previewUrl && (
                    <iframe
                      title={previewFile.name}
                      className="w-full h-full"
                      src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                        previewUrl
                      )}`}
                    />
                  )}
                {previewFile &&
                  kindFromName(previewFile.name) === "other" &&
                  previewUrl && (
                    <div className="flex flex-col items-center justify-center text-gray-500 p-4">
                      <p>Aperçu indisponible pour ce type de fichier.</p>
                      <a
                        className="btn-primary mt-3"
                        href={previewUrl}
                        download={previewFile.name.replace(/^\d+_/, "")}
                      >
                        Télécharger
                      </a>
                    </div>
                  )}
                {!previewUrl && (
                  <div className="text-gray-400 text-sm">
                    Chargement de l’aperçu…
                  </div>
                )}
              </div>
            </div>

            {/* Actions du modal — non-admin: uniquement Télécharger */}
            <div className="mt-3 flex flex-wrap gap-2">
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

              {isAdmin && (
                <>
                  <button
                    className="btn"
                    onClick={() => openShare(previewFile)}
                  >
                    <Share2 size={16} className="inline mr-1" /> Partager
                  </button>
                  <button
                    className="btn"
                    onClick={() => openAccessFile(previewFile)}
                  >
                    <Shield size={16} className="inline mr-1" /> Accès
                  </button>
                </>
              )}
            </div>

            {previewFile?.fullPath && (
              <AccessReadOnly blockPath={previewFile.fullPath} />
            )}

            {/* {previewFile?.fullPath && (
              <div className="mt-6">
                <Comments filePath={previewFile.fullPath} user={user} />
              </div>
            )} */}
          </div>
        </div>
      </Modal>

      {/* Renommage désactivé (pas demandé) */}
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
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!isAdmin) return showToast("Réservé aux admins.");
            alert("Renommage non implémenté avec Firebase Storage gratuit.");
          }}
          className="space-y-3"
        >
          <input
            className="input w-full"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            required
            disabled={!isAdmin}
          />
          <div className="flex gap-2 justify-end">
            <button type="button" className="btn" onClick={closeModal}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={!isAdmin}>
              Renommer
            </button>
          </div>
        </form>
      </Modal>

      {/* Suppressions */}
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
            disabled={!isAdmin}
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
          Voulez-vous vraiment supprimer le dossier <b>{target?.name}</b> ?
          <div className="text-xs text-gray-500 mt-1">
            (Supprime d’abord les fichiers qu’il contient.)
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button className="btn" onClick={closeModal}>
            Annuler
          </button>
          <button
            className="btn-primary bg-red-600 hover:bg-red-700"
            onClick={handleDeleteFolder}
            disabled={!isAdmin}
          >
            Supprimer
          </button>
        </div>
      </Modal>

      {/* Partage */}
      <Modal
        open={shareOpen}
        title={`Partager : ${shareTarget?.name?.replace(/^\d+_/, "") || ""}`}
        onClose={closeShare}
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-700">
            Lien direct de téléchargement (accès soumis à tes règles).
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
        </div>
      </Modal>

      {/* Accès */}
      <Modal
        open={accessOpen}
        title={`Accès : ${
          accessTarget?.name?.replace(/^\d+_/, "") ||
          accessTarget?.fullPath ||
          ""
        }`}
        onClose={closeAccess}
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            Définissez qui peut <b>voir & télécharger</b> ce{" "}
            {accessIsFolder ? "dossier" : "fichier"}.
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={accessPublic}
              onChange={(e) => setAccessPublic(e.target.checked)}
              disabled={!isAdmin}
            />
            Rendre {accessIsFolder ? "le dossier" : "le fichier"} <b>public</b>
          </label>
          <div>
            <div className="text-sm mb-1">
              E-mails autorisés (séparés par virgule) :
            </div>
            <input
              className="input w-full"
              placeholder="alice@ex.com, bob@ex.com"
              value={accessEmails}
              onChange={(e) => setAccessEmails(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn" onClick={closeAccess}>
              Annuler
            </button>
            <button
              className="btn-primary"
              onClick={saveAccess}
              disabled={!isAdmin}
            >
              Enregistrer
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* ----- bloc lecture seule des accès (modal aperçu) ----- */
function AccessReadOnly({ blockPath }) {
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const id = base64url(normalizeKey(blockPath));
      const snap = await getDoc(doc(db, "metas", id));
      if (!alive) return;
      setMeta(snap.exists() ? snap.data() : null);
    })();
    return () => {
      alive = false;
    };
  }, [blockPath]);

  if (!meta) return null;
  return (
    <div className="mt-4 text-sm text-gray-600 bg-gray-50 rounded p-3 border">
      <div>
        <b>Visibilité :</b> {meta.is_public ? "Public" : "Privé"}
      </div>
      <div>
        <b>Propriétaire :</b> {meta.owner_email || "—"}
      </div>
      <div className="break-words">
        <b>E-mails autorisés :</b>{" "}
        {(meta.allowed_emails || []).join(", ") || "—"}
      </div>
    </div>
  );
}
