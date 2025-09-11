import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export function toBase64url(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
export function normalizeKey(p) {
  return p || "";
}

export function getEffectiveMeta(path, metaMap) {
  if (!path) return null;
  const exact = metaMap[normalizeKey(path)];
  if (exact) return exact;
  const parts = path.split("/");
  for (let i = parts.length - 1; i > 0; i--) {
    const key = parts.slice(0, i).join("/") + "/";
    if (metaMap[key]) return metaMap[key];
  }
  return null;
}

export function canUserRead(meta, email) {
  if (!meta) return false;
  const me = (email || "").toLowerCase();
  if (meta.is_public) return true;
  if ((meta.owner_email || "").toLowerCase() === me) return true;
  if (
    Array.isArray(meta.allowed_emails) &&
    meta.allowed_emails.map((x) => (x || "").toLowerCase()).includes(me)
  )
    return true;
  return !!meta.__isAdmin;
}
export function canUserManage(meta, email) {
  const me = (email || "").toLowerCase();
  return !!meta?.__isAdmin || (meta?.owner_email || "").toLowerCase() === me;
}

export async function amIAdmin(email) {
  if (!email) return false;
  const d = await getDoc(doc(db, "admins", email.toLowerCase()));
  return d.exists();
}

export function parseEmailList(s) {
  if (!s) return [];
  return s
    .split(/[,\s;]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}
