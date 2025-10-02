// src/components/SharePointTable.jsx
import { useEffect, useState } from "react";
import { auth, db, storage } from "../firebase";
import {
  ref as sRef,
  listAll,
  getMetadata,
  getDownloadURL,
  deleteObject,
  getBlob,
  uploadBytesResumable,
} from "firebase/storage";
import JSZip from "jszip";
import { useNavigate } from "react-router-dom";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx";
import mammoth from "mammoth/mammoth.browser";
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
import { logActivity } from "../lib/activityLog";
import { softDeleteFile, softDeleteFolder } from "../lib/trash";

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
  function cleanName(name) {
    return (name || "").replace(/^\d+_/, "");
  }
// Pour sécuriser les téléchargements sans toucher à la config globale,
// on construit une référence absolue vers le bucket appspot.
const __BUCKET = (import.meta.env.VITE_FB_STORAGE_BUCKET || "").trim();
const __ABS_BUCKET = __BUCKET
  ? __BUCKET.startsWith("gs://")
    ? __BUCKET
    : `gs://${__BUCKET}`
  : "";
  function absRef(fullPath) {
  const p = (fullPath || "")
    .replace(/^\/+/, "")
    .replace(/^files\//, "");
  return __ABS_BUCKET
    ? sRef(storage, `${__ABS_BUCKET}/files/${p}`)
    : sRef(storage, `files/${p}`);
}
function absPreviewRef(previewPath) {
  const p = (previewPath || "").replace(/^\/+/, "");
  return __ABS_BUCKET ? sRef(storage, `${__ABS_BUCKET}/${p}`) : sRef(storage, p);
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
  const navigate = useNavigate();

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
  const [previewImgUrl, setPreviewImgUrl] = useState("");
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");

  // Partage
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [shareUrl, setShareUrl] = useState("");

  // Accès
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState(null);
  const [accessPublic, setAccessPublic] = useState(false);
  const [accessEmails, setAccessEmails] = useState("");
  // Gestion type "chips" comme dans Preview.jsx
  const [accessEmailList, setAccessEmailList] = useState([]);
  const [accessPendingEmail, setAccessPendingEmail] = useState("");
  const [accessIsFolder, setAccessIsFolder] = useState(false);

  // Initialiser la liste d'e-mails (tags) quand le modal s'ouvre
  useEffect(() => {
    if (!accessOpen) return;
    const list = (accessEmails || "")
      .split(/[\s,;]+/)
      .map((e) => (e || "").trim().toLowerCase())
      .filter(Boolean);
    const seen = new Set();
    const uniq = [];
    for (const e of list) {
      if (!seen.has(e)) {
        uniq.push(e);
        seen.add(e);
      }
    }
    setAccessEmailList(uniq);
    setAccessPendingEmail("");
  }, [accessOpen, accessEmails]);

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const showToast = (msg) => {
    setToastMsg(msg);
    setToastOpen(true);
  };

  // ZIP progress UI
  const [zipOpen, setZipOpen] = useState(false);
  const [zipPct, setZipPct] = useState(0); // 0..100
  const [zipAdded, setZipAdded] = useState(0);
  const [zipTotal, setZipTotal] = useState(0);
  const [zipCurrent, setZipCurrent] = useState("");

  // Liste récursive de tous les fichiers d'un dossier (sous-dossiers inclus).
  async function listAllFilesRecursive(rootPath) {
    const acc = [];
    const start = (rootPath || "").replace(/^\/+|\/+$/g, "");
    async function walk(prefix) {
      const res = await listAll(sRef(storage, `files/${prefix}`));
      for (const itemRef of res.items) {
        const name = itemRef.name || "";
        if (name === ".emptyFolderPlaceholder" || name === ".folder") continue;
        const rel = (itemRef.fullPath || "").replace(/^files\//, "");
        acc.push(rel);
      }
      for (const p of res.prefixes) {
        const next = `${prefix}/${p.name}`.replace(/\/+$/, "");
        // eslint-disable-next-line no-await-in-loop
        await walk(next);
      }
    }
    await walk(start);
    return acc;
  }

  // Crée un ZIP à partir d'une liste d'entrées { fullPath, zipPath }.
  async function buildAndDownloadZip(entries, zipName) {
    if (!entries || entries.length === 0) return;
    setZipOpen(true);
    setZipPct(0);
    setZipTotal(entries.length);
    setZipAdded(0);
    setZipCurrent("");

    const zip = new JSZip();
    let added = 0;
    let failed = 0;
    try {
      for (const e of entries) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const blob = await getBlob(absRef(e.fullPath));
          zip.file(e.zipPath, blob);
          added++;
          setZipAdded((n) => n + 1);
          setZipCurrent(e.zipPath);
        } catch (err) {
          console.error("zip add failed", e.fullPath, err);
          failed++;
        }
      }
      if (added === 0) throw new Error("zip_empty");

      const out = await zip.generateAsync(
        { type: "blob" },
        (meta) => {
          if (typeof meta?.percent === "number") {
            const p = Math.max(0, Math.min(100, Math.round(meta.percent)));
            setZipPct(p);
          }
          if (meta?.currentFile) setZipCurrent(meta.currentFile);
        }
      );
      const url = URL.createObjectURL(out);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName || `telechargements_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showToast(
        `ZIP prêt: ${added} fichier(s)${failed ? `, ${failed} échec(s)` : ""}.`
      );
      try {
        await logActivity(db, auth.currentUser, {
          action: "download_zip",
          meta: { added, failed, name: a.download },
        });
      } catch {}
    } finally {
      // fermer l'UI après un petit délai pour laisser l'utilisateur voir 100%
      setTimeout(() => setZipOpen(false), 400);
    }
  }

  async function downloadFolderAsZip(folderPath, folderName) {
    const files = await listAllFilesRecursive(folderPath);
    if (files.length === 0) {
      showToast("Dossier vide.");
      return;
    }
    const root = folderPath.replace(/\/+$/, "");
    const base = folderName || root.split("/").pop();
    const entries = files.map((fp) => {
      const relInside = fp.slice(root.length + 1); // partie après "folder/"
      const parts = relInside.split("/");
      const fname = parts.pop();
      parts.push(cleanName(fname));
      const zipPath = `${base}/${parts.join("/")}`;
      return { fullPath: fp, zipPath };
    });
    await buildAndDownloadZip(entries, `${base}.zip`);
  }

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
        const meta = await getMetadata(itemRef);
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
    setPreviewImgUrl("");
    setPreviewPdfUrl("");
    setPreviewOpen(true);
    try {
      const url = await getDownloadURL(absRef(file.fullPath));
      setPreviewUrl(url);
      // Récupérer la meta à jour (sans cache) pour capturer un preview généré juste après l'upload
      try {
        const metaId = base64url(normalizeKey(file.fullPath));
        const fresh = await getDoc(doc(db, "metas", metaId));
        const data = fresh.exists() ? fresh.data() : null;
        if (data?.preview_pdf_path) {
          const pdfUrl = await getDownloadURL(absPreviewRef(data.preview_pdf_path));
          setPreviewPdfUrl(pdfUrl);
        } else if (data?.preview_img_path) {
          const img = await getDownloadURL(absPreviewRef(data.preview_img_path));
          setPreviewImgUrl(img);
        }
      } catch {}
      // Si pas de preview enregistré, tenter une génération rapide côté client (fallback)
      if (kindFromName(file.name) === "office" && !previewPdfUrl && !previewImgUrl) {
        try {
          await generateAndUploadPreview(file);
        } catch {}
      }
      // Re-check shortly in case preview finished asynchronously
      if (!previewPdfUrl && !previewImgUrl) {
        setTimeout(async () => {
          try {
            const metaId = base64url(normalizeKey(file.fullPath));
            const fresh = await getDoc(doc(db, "metas", metaId));
            const data = fresh.exists() ? fresh.data() : null;
            if (data?.preview_pdf_path) {
              const pdfUrl = await getDownloadURL(absPreviewRef(data.preview_pdf_path));
              setPreviewPdfUrl(pdfUrl);
            } else if (data?.preview_img_path) {
              const img = await getDownloadURL(absPreviewRef(data.preview_img_path));
              setPreviewImgUrl(img);
            }
          } catch {}
        }, 1500);
      }
    } catch {
      showToast("Impossible d’ouvrir l’aperçu.");
    }
  }

  async function generateAndUploadPreview(file) {
    try {
      const blob = await getBlob(absRef(file.fullPath));
      const arr = await blob.arrayBuffer();
      const cont = document.createElement("div");
      cont.style.position = "fixed";
      cont.style.left = "-10000px";
      cont.style.top = "0";
      cont.style.width = "1024px";
      cont.style.padding = "16px";
      cont.style.background = "white";
      document.body.appendChild(cont);

      const lower = (file.name || "").toLowerCase();
      if (/\.docx?$/.test(lower)) {
        const res = await mammoth.convertToHtml(
          { arrayBuffer: arr },
          {
            includeDefaultStyleMap: true,
            convertImage: mammoth.images.inline((element) =>
              element.read("base64").then((imageBuffer) => {
                const ct = element.contentType || "image/png";
                return { src: `data:${ct};base64,${imageBuffer}` };
              })
            ),
          }
        );
        cont.innerHTML = `<div style="font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Arial">${
          res.value || ""
        }</div>`;
      } else if (/\.xlsx?$/.test(lower)) {
        const wb = XLSX.read(arr, { type: "array" });
        const name = wb.SheetNames[0];
        const ws = wb.Sheets[name];
        const html = XLSX.utils.sheet_to_html(ws, {
          header: `<h3 style='margin:0 0 8px 0;font:600 18px system-ui'>${name || "Feuille"}</h3>`,
          footer: "",
        });
        cont.innerHTML = html;
      } else {
        document.body.removeChild(cont);
        return;
      }

      // Attendre les images éventuelles
      await new Promise((r) => setTimeout(r, 80));
      const imgs = Array.from(cont.querySelectorAll("img"));
      await Promise.race([
        Promise.all(
          imgs.map(
            (img) =>
              new Promise((resolve) => {
                if (img.complete) return resolve();
                img.onload = img.onerror = () => resolve();
              })
          )
        ),
        new Promise((r) => setTimeout(r, 1200)),
      ]);

      const canvas = await html2canvas(cont, { backgroundColor: "#ffffff", scale: 1.5 });
      const pngBlob = await new Promise((r) => canvas.toBlob(r, "image/png", 0.92));
      document.body.removeChild(cont);
      if (!pngBlob) return;

      const previewPath = `previews/${file.fullPath}.png`;
      await uploadBytesResumable(sRef(storage, previewPath), pngBlob, {
        contentType: "image/png",
      });
      const metaId = base64url(normalizeKey(file.fullPath));
      await setDoc(
        doc(db, "metas", metaId),
        {
          preview_img_path: previewPath,
          preview_generated_at: serverTimestamp(),
        },
        { merge: true }
      );
      const dl = await getDownloadURL(absPreviewRef(previewPath));
      setPreviewImgUrl(dl);
    } catch (e) {
      console.warn("generateAndUploadPreview failed", e);
    }
  }
  function closePreview() {
    setPreviewOpen(false);
    setPreviewFile(null);
    setPreviewUrl("");
    setPreviewImgUrl("");
    setPreviewPdfUrl("");
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
    if (!window.confirm(`Déplacer ${selected.length} élément(s) dans la corbeille ?`)) return;
    const folderSet = new Set(
      folders.map((f) => (currentPath ? `${currentPath}/${f.name}` : f.name))
    );
    let moved = 0;
    for (const p of selected) {
      try {
        if (folderSet.has(p)) {
          await softDeleteFolder(storage, p, auth.currentUser?.email);
          await logActivity(db, auth.currentUser, { action: "trash_folder", target: p });
        } else {
          await softDeleteFile(storage, p, auth.currentUser?.email);
          await logActivity(db, auth.currentUser, { action: "trash_file", target: p });
        }
        moved++;
      } catch (e) {}
    }
    setSelected([]);
    fetchFilesAndFolders(isAdmin);
    showToast(`${moved} élément(s) déplacé(s) dans la corbeille.`);
  }

  async function handleDownloadSelected() {
    if (!isAdmin) return;
    const targets = files.filter((file) => selected.includes(file.fullPath));
    const selectedFolderObjs = folders.filter((folder) => {
      const fp = currentPath ? `${currentPath}/${folder.name}` : folder.name;
      return selected.includes(fp);
    });
    if (targets.length === 0) {
      showToast("Sélectionne au moins un fichier téléchargeable.");
      return;
    }

    const totalSelectedItems = targets.length + selectedFolderObjs.length;
    if (totalSelectedItems === 0) {
      showToast("Sélection vide.");
      return;
    }

    // Si au moins un dossier ou plus d'un élément → ZIP combiné
    if (selectedFolderObjs.length > 0 || totalSelectedItems > 1) {
      try {
        // Construit les entrées à zipper
        const entries = [];
        // Fichiers sélectionnés à la racine du zip
        for (const f of targets) {
          entries.push({
            fullPath: f.fullPath,
            zipPath: cleanName(f.name),
          });
        }
        // Dossiers sélectionnés, avec leur structure interne
        for (const d of selectedFolderObjs) {
          const folderPath = currentPath
            ? `${currentPath}/${d.name}`
            : d.name;
          const filesIn = await listAllFilesRecursive(folderPath);
          const base = d.name;
          for (const fp of filesIn) {
            const relInside = fp.slice(folderPath.length + 1);
            const parts = relInside.split("/");
            const fname = parts.pop();
            parts.push(cleanName(fname));
            const zipPath = `${base}/${parts.join("/")}`;
            entries.push({ fullPath: fp, zipPath });
          }
        }
        const stamp = new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\..+/, "");
        await buildAndDownloadZip(entries, `selection_${stamp}.zip`);
      } catch (e) {
        console.error("zip selection failed", e);
        showToast("Création du ZIP impossible.");
      }
      return;
    }

    // Un seul fichier seulement
    try {
      await forceDownload(targets[0], cleanName(targets[0].name));
      showToast("Téléchargement démarré.");
    } catch {
      showToast("Téléchargement impossible.");
    }
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

  function closeModal() {
    setModalOpen(false);
    setModalType("");
    setTarget(null);
    setNewName("");
  }

  async function handleDelete() {
    if (!isAdmin || !target) return;
    try {
      await softDeleteFile(storage, target.fullPath, auth.currentUser?.email);
      await logActivity(db, auth.currentUser, {
        action: "trash_file",
        target: target.fullPath,
      });
    } catch {}
    fetchFilesAndFolders(isAdmin);
    closeModal();
    showToast("Fichier déplacé dans la corbeille.");
  }

  async function handleDeleteFolder() {
    if (!isAdmin || !target) return;
    const folderPath = currentPath
      ? `${currentPath}/${target.name}`
      : `${target.name}`;
    try {
      await softDeleteFolder(storage, folderPath, auth.currentUser?.email);
      await logActivity(db, auth.currentUser, {
        action: "trash_folder",
        target: folderPath,
      });
    } catch {}
    fetchFilesAndFolders(isAdmin);
    closeModal();
    showToast("Dossier déplacé dans la corbeille.");
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
    const list = (own.allowed_emails || [])
      .map((e) => (e || "").trim().toLowerCase())
      .filter(Boolean);
    const seen = new Set();
    const uniq = [];
    for (const e of list) {
      if (!seen.has(e)) {
        uniq.push(e);
        seen.add(e);
      }
    }
    setAccessEmails(uniq.join(", "));
    setAccessEmailList(uniq);
    setAccessPendingEmail("");
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
    const list = (own.allowed_emails || [])
      .map((e) => (e || "").trim().toLowerCase())
      .filter(Boolean);
    const seen = new Set();
    const uniq = [];
    for (const e of list) {
      if (!seen.has(e)) {
        uniq.push(e);
        seen.add(e);
      }
    }
    setAccessEmails(uniq.join(", "));
    setAccessEmailList(uniq);
    setAccessPendingEmail("");
    setAccessOpen(true);
  }
  function closeAccess() {
    setAccessOpen(false);
    setAccessTarget(null);
    setAccessEmails("");
    setAccessEmailList([]);
    setAccessPendingEmail("");
    setAccessPublic(false);
    setAccessIsFolder(false);
  }
  async function saveAccess() {
    if (!isAdmin || !accessTarget) return;
    const path = normalizeKey(accessTarget.fullPath);
    const metaId = base64url(path);
    const clean = (s) => (s || "").trim().toLowerCase();
    let base = accessEmailList.map(clean).filter(Boolean);
    const extra = clean(accessPendingEmail);
    if (extra && !base.includes(extra)) base = [...base, extra];
    setAccessEmails(base.join(", "));
    const payload = {
      file_path: path,
      is_public: accessPublic,
      allowed_emails: base,
      owner_email: (await getEffectiveMeta(path, metaCache))?.owner_email || me,
      updated_at: serverTimestamp(),
    };
    await setDoc(doc(db, "metas", metaId), payload, { merge: true });
    metaCache.set(path, payload);
    showToast("Accès mis à jour.");
    closeAccess();
  }

  async function forceDownload(file, requestedName) {
    const fileName = requestedName || file?.name || "download";
    try {
      const raw = await getDownloadURL(absRef(file.fullPath));
      const url = new URL(raw);
      const encoded = encodeURIComponent(fileName);
      url.searchParams.set(
        "response-content-disposition",
        `attachment; filename*=UTF-8''${encoded}`
      );
      // Téléchargement via <a download> (évite doubles déclenchements)
      const a = document.createElement("a");
      a.href = url.toString();
      a.download = fileName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      try {
        await logActivity(db, auth.currentUser, {
          action: "download_file",
          target: file.fullPath,
        });
      } catch {}
    } catch (err) {
      console.error("forceDownload failed", err);
      showToast("Téléchargement impossible.");
      throw err;
    }
  }

  async function downloadAsZip(targets) {
    showToast("Préparation du ZIP…");
    const zip = new JSZip();
    let added = 0;
    let failed = 0;
    for (const f of targets) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const blob = await getBlob(absRef(f.fullPath));
        zip.file(cleanName(f.name), blob);
        added++;
      } catch (e) {
        console.error("zip item failed", f.fullPath, e);
        failed++;
      }
    }
    if (added === 0) throw new Error("zip_empty");

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    const stamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\..+/, "");
    a.href = url;
    a.download = `telechargements_${stamp}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast(
      `ZIP prêt: ${added} fichier(s)${failed ? `, ${failed} échec(s)` : ""}.`
    );
  }

  /* ===================== RENDER ===================== */
  return (
    <>
      <ToastLite
        open={toastOpen}
        message={toastMsg}
        onClose={() => setToastOpen(false)}
      />

      <Modal
        open={zipOpen}
        title="Préparation du ZIP"
        onClose={() => {}}
        size="md"
      >
        <div className="space-y-3">
          <div className="text-sm text-gray-700">
            Ajout des fichiers… {zipAdded}/{zipTotal}
          </div>
          <div className="w-full h-2 bg-gray-200 rounded">
            <div
              className="h-2 rounded bg-amber-900 transition-all"
              style={{ width: `${zipPct}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 truncate">
            {zipCurrent || ""}
          </div>
          <div className="text-xs text-gray-400">
            Merci de patienter, ne fermez pas cette fenêtre.
          </div>
        </div>
      </Modal>

      {/* BARRE D’ACTIONS MULTI-SÉLECTION — Admin uniquement */}
      {isAdmin && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 mb-4 px-3 sm:px-4 py-2 bg-white/70 rounded-xl shadow border border-gray-200">
          <span className="text-green-900 font-semibold text-base">
            <span className="bg-blue-50 rounded px-2 py-1">
              {selected.length}
            </span>{" "}
            sélectionné{selected.length > 1 ? "s" : ""}
          </span>
          <button
            className="flex items-center gap-1 sm:gap-2 bg-gray-100 text-gray-800 px-2 sm:px-4 py-2 rounded-lg shadow-sm sm:font-semibold border border-gray-300 hover:shadow-md active:scale-95"
            onClick={handleDeleteSelected}
            aria-label="Supprimer la sélection"
          >
            <Trash2 size={18} className="text-red-500" />
            <span className="hidden sm:inline">Supprimer</span>
          </button>
          <button
            className="flex items-center gap-1 sm:gap-2 bg-blue-50 text-blue-800 px-2 sm:px-4 py-2 rounded-lg shadow-sm sm:font-semibold border border-blue-200 hover:bg-blue-100 active:scale-95"
            onClick={handleDownloadSelected}
            aria-label="Télécharger la sélection"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Télécharger</span>
          </button>
          <button
            className="ml-1 px-2 sm:px-4 py-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 sm:font-medium border border-gray-200 shadow-sm"
            onClick={unselectAll}
            aria-label="Tout désélectionner"
          >
            <span className="hidden sm:inline">Tout désélectionner</span>
            <span className="sm:hidden">Désélect.</span>
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
              <th className="py-2 px-2 text-left font-normal w-auto whitespace-nowrap hidden md:table-cell">
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
                            title="Télécharger (ZIP)"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const fp = currentPath
                                ? `${currentPath}/${folder.name}`
                                : folder.name;
                              await downloadFolderAsZip(fp, folder.name);
                            }}
                          >
                            <Download size={17} />
                          </button>
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
                          onClick={() => navigate(`/preview?path=${encodeURIComponent(file.fullPath)}&from=${encodeURIComponent(currentPath || "")}`)}
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
                            forceDownload(file, file.name.replace(/^\d+_/, ""))
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
                      onClick={async (e) => {
                        e.stopPropagation();
                        const fp = currentPath
                          ? `${currentPath}/${folder.name}`
                          : folder.name;
                        await downloadFolderAsZip(fp, folder.name);
                      }}
                      title="Télécharger (ZIP)"
                    >
                      <Download size={18} />
                    </button>
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
                  onClick={() => navigate(`/preview?path=${encodeURIComponent(file.fullPath)}&from=${encodeURIComponent(currentPath || "")}`)}
                >
                  {file.name.replace(/^\d+_/, "")}
                </button>

                <button
                  className="text-gray-400 hover:text-amber-900 px-1 shrink-0"
                  onClick={() =>
                    forceDownload(file, file.name.replace(/^\d+_/, ""))
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
                {previewFile && previewPdfUrl && (
                  <iframe
                    src={previewPdfUrl}
                    title={previewFile.name}
                    className="w-full h-full"
                  />
                )}
                {previewFile && !previewPdfUrl && previewImgUrl && (
                  <img
                    src={previewImgUrl}
                    alt={previewFile.name}
                    className="max-w-full max-h-full object-contain"
                  />
                )}
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
                  previewUrl && !previewPdfUrl && (
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
                {previewFile && !previewImgUrl && kindFromName(previewFile.name) === "office" && (
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
                    previewFile,
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
            <div className="text-sm text-gray-600 mb-1">E-mails autorisés</div>
            {accessEmailList.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {accessEmailList.map((e) => (
                  <span
                    key={e}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-900/40 text-amber-900 bg-amber-50 text-xs"
                  >
                    {e}
                    {isAdmin && (
                      <button
                        type="button"
                        className="ml-1 text-amber-900/70 hover:text-amber-900"
                        onClick={() =>
                          setAccessEmailList((list) => list.filter((x) => x !== e))
                        }
                        aria-label={`Retirer ${e}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            )}
            <input
              className="input w-full"
              value={accessPendingEmail}
              onChange={(e) => setAccessPendingEmail(e.target.value)}
              placeholder="Ajouter un e-mail (ex: alice@ex.com)"
              disabled={!isAdmin}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const clean = (s) => (s || "").trim().toLowerCase();
                  const v = clean(accessPendingEmail);
                  if (!v) return;
                  setAccessEmailList((list) =>
                    list.includes(v) ? list : [...list, v]
                  );
                  setAccessPendingEmail("");
                }
              }}
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

/* ===================== Office internal preview helpers ===================== */
async function buildOfficePreviewHTMLFromBlob(blob, filename) {
  const lower = (filename || "").toLowerCase();
  try {
    if (/\.(docx?)$/.test(lower)) return await buildDocxHTML(blob);
    if (/\.(xlsx?)$/.test(lower)) return await buildXlsxHTML(blob);
    return "";
  } catch (e) {
    console.warn("buildOfficePreview failed", e);
    return "";
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function buildDocxHTML(blob) {
  const zip = await JSZip.loadAsync(blob);
  const docEntry = zip.file("word/document.xml");
  if (!docEntry) return "";
  const relsEntry = zip.file("word/_rels/document.xml.rels");
  const relsMap = new Map();
  if (relsEntry) {
    const relsXML = await relsEntry.async("string");
    const rdoc = new DOMParser().parseFromString(relsXML, "application/xml");
    Array.from(rdoc.getElementsByTagName("Relationship")).forEach((n) => {
      relsMap.set(n.getAttribute("Id"), n.getAttribute("Target"));
    });
  }
  const xml = await docEntry.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

  async function renderRun(r) {
    const rPr = r.getElementsByTagNameNS(W, "rPr")[0];
    let style = "";
    let open = "";
    let close = "";
    if (rPr) {
      if (rPr.getElementsByTagNameNS(W, "b").length) {
        open += "<b>";
        close = "</b>" + close;
      }
      if (rPr.getElementsByTagNameNS(W, "i").length) {
        open += "<i>";
        close = "</i>" + close;
      }
      if (rPr.getElementsByTagNameNS(W, "u").length) {
        open += "<u>";
        close = "</u>" + close;
      }
      const color = rPr.getElementsByTagNameNS(W, "color")[0]?.getAttribute("val");
      if (color) style += `color:#${color};`;
      const sz = rPr.getElementsByTagNameNS(W, "sz")[0]?.getAttribute("val");
      if (sz) style += `font-size:${Number(sz) / 2}pt;`;
    }
    let content = "";
    const ts = r.getElementsByTagNameNS(W, "t");
    for (const t of Array.from(ts)) content += esc(t.textContent || "");
    if (!ts.length) {
      if (r.getElementsByTagNameNS(W, "br").length) content += "<br/>";
      if (r.getElementsByTagNameNS(W, "tab").length) content += "&nbsp;&nbsp;&nbsp;&nbsp;";
    }

    // images (w:drawing -> a:blip r:embed)
    const drawings = r.getElementsByTagNameNS(W, "drawing");
    if (drawings.length) {
      for (const d of Array.from(drawings)) {
        const blips = d.getElementsByTagNameNS(A, "blip");
        for (const blip of Array.from(blips)) {
          const rid =
            blip.getAttributeNS(R, "embed") ||
            blip.getAttribute("r:embed") ||
            blip.getAttribute("r:link");
          if (rid && relsMap.has(rid)) {
            const target = relsMap.get(rid).replace(/^\//, "");
            const path = target.startsWith("word/") ? target : `word/${target}`;
            const file = zip.file(path);
            if (file) {
              const base64 = await file.async("base64");
              const ext = (path.split(".").pop() || "png").toLowerCase();
              const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
              content += `<img src="data:${mime};base64,${base64}" style="max-width:100%;" />`;
            }
          }
        }
      }
    }
    // VML fallback: v:imagedata r:id
    const vimgs = r.getElementsByTagName("v:imagedata");
    if (vimgs.length) {
      for (const vi of Array.from(vimgs)) {
        const rid = vi.getAttribute("r:id") || vi.getAttributeNS(R, "id");
        if (rid && relsMap.has(rid)) {
          const target = relsMap.get(rid).replace(/^\//, "");
          const path = target.startsWith("word/") ? target : `word/${target}`;
          const file = zip.file(path);
          if (file) {
            const base64 = await file.async("base64");
            const ext = (path.split(".").pop() || "png").toLowerCase();
            const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
            content += `<img src="data:${mime};base64,${base64}" style="max-width:100%;" />`;
          }
        }
      }
    }

    if (style) return `${open}<span style="${style}">${content}</span>${close}`;
    return open + content + close;
  }

  async function renderParagraph(p) {
    const runs = Array.from(p.getElementsByTagNameNS(W, "r"));
    const parts = await Promise.all(runs.map((r) => renderRun(r)));
    const txt = parts.join("") || "&nbsp;";
    // alignment
    const jc = p.getElementsByTagNameNS(W, "jc")[0]?.getAttribute("val");
    const style = jc ? `text-align:${jc};` : "";
    return `<p style="${style}">${txt}</p>`;
  }

  async function renderTable(tbl) {
    const rows = Array.from(tbl.getElementsByTagNameNS(W, "tr"));
    const trsArr = [];
    for (const tr of rows) {
      const tcs = Array.from(tr.getElementsByTagNameNS(W, "tc"));
      const cellHtml = [];
      for (const tc of tcs) {
        const innerPs = Array.from(tc.getElementsByTagNameNS(W, "p"));
        const innerParts = await Promise.all(innerPs.map((p) => renderParagraph(p)));
        const inner = innerParts.join("");
        cellHtml.push(`<td class=\"border px-2 py-1 align-top\">${inner}</td>`);
      }
      trsArr.push(`<tr>${cellHtml.join("")}</tr>`);
    }
    const trs = trsArr.join("");
    return `<table class=\"min-w-full border-collapse\"><tbody>${trs}</tbody></table>`;
  }

  const children = Array.from(doc.documentElement.childNodes);
  const parts = [];
  for (const node of children) {
    if (node.namespaceURI === W && node.localName === "p") parts.push(renderParagraph(node));
    else if (node.namespaceURI === W && node.localName === "tbl") parts.push(renderTable(node));
  }
  const resolved = await Promise.all(parts);
  return resolved.join("\n");
}

function colLettersToIndex(ref) {
  let s = ref.replace(/\d+/g, "");
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

async function buildXlsxHTML(blob) {
  const zip = await JSZip.loadAsync(blob);
  // Shared strings
  let sst = [];
  const sstEntry = zip.file("xl/sharedStrings.xml");
  if (sstEntry) {
    const xml = await sstEntry.async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    sst = Array.from(doc.getElementsByTagName("si")).map((si) => {
      const ts = si.getElementsByTagName("t");
      let txt = "";
      for (const t of Array.from(ts)) txt += t.textContent || "";
      return txt;
    });
  }

  // Workbook => list of sheets
  const wbXml = await zip.file("xl/workbook.xml").async("string");
  const wb = new DOMParser().parseFromString(wbXml, "application/xml");
  const sheets = Array.from(wb.getElementsByTagName("sheet")).map((el) => ({
    name: el.getAttribute("name") || "Feuille",
    rId: el.getAttribute("r:id"),
  }));
  const relXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const relDoc = new DOMParser().parseFromString(relXml, "application/xml");
  function pathFor(rId) {
    const rel = Array.from(relDoc.getElementsByTagName("Relationship")).find(
      (n) => n.getAttribute("Id") === rId
    );
    const target = rel?.getAttribute("Target") || "worksheets/sheet1.xml";
    return `xl/${target.replace(/^\//, "")}`;
  }

  // Render first sheet only (to keep fast)
  const first = sheets[0];
  const sheetPath = pathFor(first?.rId);
  const sheetXml = await zip.file(sheetPath).async("string");
  const sdoc = new DOMParser().parseFromString(sheetXml, "application/xml");

  // Build table
  let maxCol = 0;
  const rows = Array.from(sdoc.getElementsByTagName("row"));
  const table = [];
  for (const row of rows) {
    const arr = [];
    for (const c of Array.from(row.getElementsByTagName("c"))) {
      const ref = c.getAttribute("r") || "";
      const ci = colLettersToIndex(ref);
      if (ci > maxCol) maxCol = ci;
      let val = "";
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0];
      const is = c.getElementsByTagName("is")[0];
      if (t === "s" && v) {
        val = sst[parseInt(v.textContent || "0", 10)] ?? "";
      } else if (t === "inlineStr" && is) {
        const tnode = is.getElementsByTagName("t")[0];
        val = tnode?.textContent || "";
      } else if (v) {
        val = v.textContent || "";
      }
      arr[ci] = esc(val);
    }
    table.push(arr);
  }
  const rowsHTML = table
    .map((r) => {
      const tds = [];
      for (let i = 0; i <= maxCol; i++) tds.push(`<td class=\"border px-2 py-1\">${r[i] || ""}</td>`);
      return `<tr>${tds.join("")}</tr>`;
    })
    .join("");
  return `<div class=\"overflow-auto\"><table class=\"min-w-full text-sm border-collapse\"><tbody>${rowsHTML}</tbody></table></div>`;
}
