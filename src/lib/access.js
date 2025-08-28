// src/lib/access.js

// --- CONFIG ADMIN(S) -------------------------------------------------
export const ADMIN_EMAILS = ["boubsfal@gmail.com", "mlaminefall@aol.com"].map(
  (e) => e.toLowerCase()
);

// --- UTILS -----------------------------------------------------------
export function parseEmailList(s = "") {
  return (s || "")
    .split(/[,\s]+/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

// normalise: dossier => finit par "/", fichier => tel quel
export function normalizeKey(path = "") {
  if (!path) return "";
  const isFolder = /\/$/.test(path);
  const clean = path.replace(/\/+/g, "/").replace(/^\//, "");
  return isFolder ? (clean.endsWith("/") ? clean : clean + "/") : clean;
}

// remonte dans l’arbre pour trouver une meta (héritage dossiers)
export function getEffectiveMeta(path, metaMap = {}) {
  const key = normalizeKey(path);
  if (!key) return null;

  if (metaMap[key]) return metaMap[key]; // exacte

  // essayer les parents (dossiers)
  const parts = key.split("/");
  const lastIdx =
    parts[parts.length - 1] === "" ? parts.length - 2 : parts.length - 1;
  for (let i = lastIdx; i > 0; i--) {
    const candidate = parts.slice(0, i).join("/") + "/";
    if (metaMap[candidate]) return metaMap[candidate];
  }
  return null;
}

// --- DROITS ----------------------------------------------------------
function isAdmin(me) {
  if (!me) return false;
  return ADMIN_EMAILS.includes(me.toLowerCase());
}

/** Lecture:
 *  - Admin: OK
 *  - Meta absente => REFUS (privé par défaut)
 *  - is_public => OK
 *  - sinon owner ou allowed_emails
 */
export function canUserRead(meta, me) {
  me = (me || "").toLowerCase();
  if (isAdmin(me)) return true;
  if (!meta) return false;

  if (meta.is_public) return true;

  const owner = (meta.owner_email || "").toLowerCase();
  if (owner && owner === me) return true;

  const allowed = Array.isArray(meta.allowed_emails)
    ? meta.allowed_emails.map((e) => (e || "").toLowerCase())
    : [];
  return allowed.includes(me);
}

/** Gestion:
 *  - Admin: OK (même sans meta)
 *  - sinon owner
 */
export function canUserManage(meta, me) {
  me = (me || "").toLowerCase();
  if (isAdmin(me)) return true;
  if (!meta) return false;

  const owner = (meta.owner_email || "").toLowerCase();
  return !!owner && owner === me;
}
