// src/lib/trash.js
import {
  ref as sRef,
  getBlob,
  getMetadata,
  uploadBytes,
  deleteObject,
  listAll,
} from "firebase/storage";

// Genère un chemin de la corbeille qui garde l'arborescence d'origine
function trashPathFor(fullPath) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `trash/${ts}/${fullPath}`; // ex: trash/2025-09-21T10-20-00Z/BL/file.jpg
}

export async function softDeleteFile(storage, fullPath, actorEmail) {
  const srcRef = sRef(storage, `files/${fullPath}`);
  const meta = await getMetadata(srcRef).catch(() => ({}));
  const blob = await getBlob(srcRef);
  const destPath = trashPathFor(fullPath);
  const destRef = sRef(storage, destPath);
  const customMetadata = {
    ...(meta?.customMetadata || {}),
    orig_path: fullPath,
    deleted_by: (actorEmail || "").toLowerCase(),
    deleted_at: new Date().toISOString(),
  };
  await uploadBytes(destRef, blob, {
    contentType: meta?.contentType,
    customMetadata,
  });
  await deleteObject(srcRef);
  return destPath;
}

export async function softDeleteFolder(storage, folderPath, actorEmail) {
  const clean = folderPath.replace(/^\/+|\/+$/g, "");
  const out = [];
  async function walk(prefix) {
    const res = await listAll(sRef(storage, `files/${prefix}`));
    for (const item of res.items) {
      const rel = (item.fullPath || "").replace(/^files\//, "");
      const moved = await softDeleteFile(storage, rel, actorEmail);
      out.push(moved);
    }
    for (const p of res.prefixes) {
      await walk(`${prefix}/${p.name}`.replace(/\/+$/, ""));
    }
  }
  await walk(clean);
  return out;
}

export async function restoreFile(storage, trashFullPath) {
  // trashFullPath: path sous bucket (ex: trash/ts/files/BL/x.jpg OU trash/ts/BL/x.jpg)
  const srcRef = sRef(storage, trashFullPath);
  const meta = await getMetadata(srcRef);
  const blob = await getBlob(srcRef);
  const orig = meta?.customMetadata?.orig_path;
  if (!orig) throw new Error("orig_path manquant sur l'élément de corbeille");
  const destRef = sRef(storage, `files/${orig}`);
  await uploadBytes(destRef, blob, { contentType: meta?.contentType, customMetadata: meta?.customMetadata });
  await deleteObject(srcRef);
}

export async function deleteForever(storage, trashFullPath) {
  const srcRef = sRef(storage, trashFullPath);
  await deleteObject(srcRef);
}

