// src/lib/firebaseStorage.js
import {
  getStorage,
  ref,
  uploadBytes,
  updateMetadata,
  getMetadata,
  getDownloadURL,
  list,
} from "firebase/storage";
import { auth } from "../firebase"; // ton auth initialisé

const storage = getStorage();

// Util : normalise emails (lowercase, trim)
function normEmail(s) {
  return (s || "").toString().trim().toLowerCase();
}

// Remplit a1..a10 à partir d'une liste d'emails
function buildAllowedSlots(emails) {
  const slots = {};
  const arr = (emails || []).map(normEmail).filter(Boolean);
  for (let i = 1; i <= 10; i++) {
    slots[`a${i}`] = arr[i - 1] || "";
  }
  return slots;
}

// ---------- CREATION DOSSIER (placeholder) ----------
export async function createFolderPlaceholder(folderPath) {
  // folderPath ex: "BL" ou "BL/Janvier"
  const clean = folderPath.replace(/^\/+|\/+$/g, ""); // sans slash tête/queue
  const objPath = clean ? `files/${clean}/.folder` : `files/.folder`;

  const user = auth.currentUser;
  if (!user?.email) throw new Error("Utilisateur non connecté");
  const owner = normEmail(user.email);

  const file = new File([""], ".folder", { type: "text/plain" }); // petit blob
  const objectRef = ref(storage, objPath);

  // METADATA OBLIGATOIRE pour passer les règles
  const metadata = {
    customMetadata: {
      owner, // <--- très important
      is_public: "false", // privé par défaut
      ...buildAllowedSlots([]),
    },
  };

  await uploadBytes(objectRef, file, metadata);
  return objPath;
}

// ---------- UPLOAD FICHIERS ----------
export async function uploadFiles(prefix, fileList) {
  // prefix ex: "" (racine) ou "BL" ou "BL/Janvier"
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const base = cleanPrefix ? `files/${cleanPrefix}` : `files`;

  const user = auth.currentUser;
  if (!user?.email) throw new Error("Utilisateur non connecté");
  const owner = normEmail(user.email);

  const uploads = [];
  for (const file of Array.from(fileList || [])) {
    const objectRef = ref(storage, `${base}/${file.name}`);

    const meta = {
      customMetadata: {
        owner, // <--- obligatoire pour create
        is_public: "false",
        ...buildAllowedSlots([]),
      },
    };

    uploads.push(uploadBytes(objectRef, file, meta));
  }
  await Promise.all(uploads);
}

// ---------- LISTER UN DOSSIER + METADATA + FILTRAGE ----------
export async function listFolderWithMeta(prefix) {
  // Retourne deux tableaux : folders[], files[]
  const cleanPrefix = prefix.replace(/^\/+|\/+$/g, "");
  const folderRef = ref(
    storage,
    cleanPrefix ? `files/${cleanPrefix}` : "files"
  );

  const res = await list(folderRef, { maxResults: 1000 });

  const folders = [];
  const files = [];

  // Sous-dossiers : Storage ne renvoie pas *nativement* les prefixes sans objets.
  // Ici, un "dossier" est reconnu s'il contient un objet `.folder`
  // ou s'il y a un "prefix" renvoyé (selon comment tu as déposé les fichiers).
  for (const p of res.prefixes) {
    // chaque prefix représente "un sous-dossier"
    const name = p.name.split("/").pop();
    folders.push({ name, fullPath: p.fullPath });
  }

  // Pour chaque item, tente de lire sa metadata.
  // Si la règle read refuse (403), on ignore => l’utilisateur ne le voit pas.
  const metaPromises = res.items.map(async (itemRef) => {
    try {
      const meta = await getMetadata(itemRef);
      const name = itemRef.name;
      // On ignore le placeholder de dossier dans la liste des fichiers
      if (name === ".folder") return null;

      return {
        name,
        fullPath: itemRef.fullPath, // ex "files/BL/mon.pdf"
        size: meta.size || 0,
        updated_at: meta.updated || meta.timeUpdated || null,
        owner: meta.customMetadata?.owner || "—",
        type: meta.contentType || null,
      };
    } catch (e) {
      // 403 : pas de droit de lecture → on n'affiche pas
      return null;
    }
  });

  const metad = await Promise.all(metaPromises);
  for (const f of metad) if (f) files.push(f);

  // Déduire des sous-dossiers via objets ".folder" si besoin
  const folderFromDot = metad
    .filter((m) => m && m.name === ".folder")
    .map((m) => {
      const parts = m.fullPath.split("/");
      const name = parts[parts.length - 2]; // le dossier parent
      return { name, fullPath: parts.slice(0, -1).join("/") };
    });

  // merge (en évitant doublons)
  const byName = new Map(folders.map((d) => [d.name, d]));
  for (const d of folderFromDot) if (!byName.has(d.name)) byName.set(d.name, d);

  return {
    folders: Array.from(byName.values()),
    files,
  };
}

// ---------- GET URL DE TÉLÉCHARGEMENT ----------
export async function getFileUrl(fullPath) {
  const objectRef = ref(storage, fullPath);
  return await getDownloadURL(objectRef); // 403 si pas autorisé
}

// ---------- MISE À JOUR DES ACCÈS (is_public + allowed emails) ----------
export async function updateAccessMeta(fullPath, { isPublic, allowedEmails }) {
  const objectRef = ref(storage, fullPath);
  const meta = await getMetadata(objectRef);

  const newCustom = {
    ...(meta.customMetadata || {}),
    is_public: isPublic ? "true" : "false",
    ...buildAllowedSlots((allowedEmails || []).map(normEmail)),
  };

  await updateMetadata(objectRef, { customMetadata: newCustom });
}
