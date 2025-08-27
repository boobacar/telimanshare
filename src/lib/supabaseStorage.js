// src/lib/supabaseStorage.js
import { supabase } from "../supabase";

const BUCKET = "files"; // <-- adapte si besoin
const DEFAULT_TTL = 60; // secondes (ex: 60s = 1 min)

/** URL signée (preview/téléchargement). */
export async function getSignedUrl(path, opts = {}) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, opts.ttl || DEFAULT_TTL, {
      download: opts.downloadName || undefined, // force 'attachment' si défini
    });
  if (error) throw error;
  return data.signedUrl;
}

/** Téléchargement direct (sans onglet). */
export async function forceDownload(path, downloadName) {
  const url = await getSignedUrl(path, { ttl: DEFAULT_TTL, downloadName });
  const res = await fetch(url);
  if (!res.ok) throw new Error("Échec du téléchargement");
  const blob = await res.blob();
  const a = document.createElement("a");
  const objUrl = URL.createObjectURL(blob);
  a.href = objUrl;
  a.download = downloadName || path.split("/").pop();
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(objUrl);
    a.remove();
  }, 200);
}

/** URL signée à partager (copiable telle quelle). */
export async function createShareLink(
  path,
  { ttlSeconds = 86400, forceDownloadName } = {}
) {
  // ttlSeconds: 1h=3600, 24h=86400, 7j=604800, 30j≈2592000
  return getSignedUrl(path, {
    ttl: ttlSeconds,
    downloadName: forceDownloadName || undefined,
  });
}

/** URL pour aperçu (img/pdf/video/office). */
export async function getPreviewUrl(path) {
  return getSignedUrl(path, { ttl: DEFAULT_TTL });
}

/** Détecte le type de fichier (pour l’aperçu). */
export function kindFromName(name = "") {
  const lower = name.toLowerCase();
  if (/\.(jpg|jpeg|png|gif|webp|avif)$/.test(lower)) return "image";
  if (/\.pdf$/.test(lower)) return "pdf";
  if (/\.(mp4|webm|mov|m4v)$/.test(lower)) return "video";
  if (/\.(doc|docx|ppt|pptx|xls|xlsx|csv|txt|rtf|odt|ods|odp)$/.test(lower))
    return "office";
  return "other";
}
