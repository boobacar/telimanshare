import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth, db, storage } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { logActivity } from "../lib/activityLog";
import useIsAdmin from "../hooks/useIsAdmin";
import { ref as sRef, getDownloadURL } from "firebase/storage";
import Modal from "../components/Modal";
// Viewers externes uniquement (MS embed + Google en secours)

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

function cleanName(name) {
  return (name || "").replace(/^\d+_/, "");
}
function kindFromName(name) {
  if (/\.(jpg|jpeg|png|gif|webp|avif)$/i.test(name)) return "image";
  if (/\.(mp4|webm|mov|m4v)$/i.test(name)) return "video";
  if (/\.pdf$/i.test(name)) return "pdf";
  if (/\.(docx?|xlsx?|pptx?)$/i.test(name)) return "office";
  return "other";
}

const __BUCKET = (import.meta.env.VITE_FB_STORAGE_BUCKET || "").trim();
const __ABS_BUCKET = __BUCKET
  ? __BUCKET.startsWith("gs://")
    ? __BUCKET
    : `gs://${__BUCKET}`
  : "";
function absRef(fullPath) {
  const p = (fullPath || "").replace(/^\/+/, "").replace(/^files\//, "");
  return __ABS_BUCKET
    ? sRef(storage, `${__ABS_BUCKET}/files/${p}`)
    : sRef(storage, `files/${p}`);
}
function absPreviewRef(previewPath) {
  const p = (previewPath || "").replace(/^\/+/, "");
  return __ABS_BUCKET
    ? sRef(storage, `${__ABS_BUCKET}/${p}`)
    : sRef(storage, p);
}

async function forceDownloadByUrl(url, fileName) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("http" + res.status);
    const blob = await res.blob();
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj;
    a.download = fileName || "download";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(obj), 1500);
  } catch {
    // Fallback en direct
    try {
      const u = new URL(url);
      const encoded = encodeURIComponent(fileName || "download");
      u.searchParams.set(
        "response-content-disposition",
        `attachment; filename*=UTF-8''${encoded}`
      );
      const a = document.createElement("a");
      a.href = u.toString();
      a.download = fileName || "download";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {}
  }
}

export default function Preview() {
  const q = useQuery();
  const navigate = useNavigate();
  const fullPath = q.get("path") || ""; // ex: FOLDER/file.xlsx
  const [url, setUrl] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [toast, setToast] = useState("");
  const me = (auth.currentUser?.email || "").toLowerCase();
  const { isAdmin } = useIsAdmin(auth.currentUser);
  const [isPublic, setIsPublic] = useState(false);
  const [emails, setEmails] = useState("");
  const [accessOpen, setAccessOpen] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [emailList, setEmailList] = useState([]);
  const [pendingEmail, setPendingEmail] = useState("");

  const name = useMemo(
    () => fullPath.split("/").pop() || "fichier",
    [fullPath]
  );
  const kind = useMemo(() => kindFromName(name), [name]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const u = await getDownloadURL(absRef(fullPath));
        if (!alive) return;
        setUrl(u);
        setShareUrl(u);
        // si PDF preview existe en meta → charger
        const id = btoa(
          unescape(
            encodeURIComponent(
              fullPath.endsWith("/") || fullPath.includes(".")
                ? fullPath
                : fullPath + "/"
            )
          )
        )
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/g, "");
        try {
          const snap = await getDoc(doc(db, "metas", id));
          if (snap.exists()) {
            const preview = snap.data()?.preview_pdf_path || "";
            setIsPublic(!!snap.data()?.is_public);
            setEmails((snap.data()?.allowed_emails || []).join(", "));
            setOwnerEmail(snap.data()?.owner_email || "");
            if (preview) {
              const purl = await getDownloadURL(absPreviewRef(preview));
              if (!alive) return;
              setPdfUrl(purl);
            }
          }
        } catch {}
      } catch (e) {
        if (!alive) return;
        setError("Impossible de charger le fichier.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [fullPath]);

  // Initialiser la liste d'e-mails quand on ouvre le modal Accès
  useEffect(() => {
    if (accessOpen) {
      const list = (emails || "")
        .split(/[\s,;]+/)
        .map((e) => (e || "").trim().toLowerCase())
        .filter(Boolean);
      // Dédoublonner
      const seen = new Set();
      const uniq = [];
      for (const e of list) {
        if (!seen.has(e)) {
          uniq.push(e);
          seen.add(e);
        }
      }
      setEmailList(uniq);
      setPendingEmail("");
    }
  }, [accessOpen, emails]);

  const googleHref = useMemo(() => {
    if (!url) return "";
    return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(
      url
    )}`;
  }, [url]);

  // Ouvre Google Viewer dans un nouvel onglet et force 2 rafraîchissements
  function openGoogleViewerWithRetries() {
    if (!googleHref) return;
    // Ouvrir un onglet immédiatement dans le contexte du clic
    const win = window.open("about:blank", "_blank", "noopener,noreferrer");
    if (!win) {
      // Fallback si le navigateur bloque: tenter ouverture simple
      window.open(googleHref, "_blank");
      return;
    }
    try {
      // Navigation initiale
      win.location.href = googleHref;
    } catch {}
    // Deux tentatives supplémentaires espacées pour forcer le rendu côté Google
    setTimeout(() => {
      try {
        // Réassigner la même URL force un rechargement
        win.location.href = googleHref;
      } catch {}
    }, 1200);
    setTimeout(() => {
      try {
        win.location.href = googleHref;
      } catch {}
    }, 2600);
  }
  // Option ultime: proxy côté serveur en prod pour fiabiliser l'URL consumée par Microsoft
  const msSrc = useMemo(() => {
    if (!url) return "";
    const proxied = `${location.origin}/api/office-proxy?u=${encodeURIComponent(
      url
    )}&name=${encodeURIComponent(cleanName(name))}`;
    // En dev (vite), /api n'existe pas → utiliser direct encodé pour tester
    const effective = import.meta.env.DEV ? url : proxied;
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
      effective
    )}&wdOrigin=BROWSELINK`;
  }, [url, name]);

  const [ctInfo, setCtInfo] = useState("");
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!url) return;
        const res = await fetch(url, { method: "GET", mode: "cors" });
        const ct = res.headers.get("content-type") || "(inconnu)";
        if (alive) setCtInfo(ct);
      } catch {
        if (alive) setCtInfo("(non accessible)");
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);

  // Plus de conversion locale: Google Viewer en onglet si pas de PDF

  // Dossier de retour (si fourni par la liste)
  const fromDir = q.get("from") || "";

  return (
    <div className="relative p-3 sm:p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex gap-8 items-center justify-between mb-3">
          <button
            className="btn"
            onClick={() => {
              if (fromDir)
                navigate(`/documents?from=${encodeURIComponent(fromDir)}`);
              else navigate(-1);
            }}
          >
            ←
          </button>
          <div className="text-sm text-gray-600 truncate ">{fullPath}</div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <h1 className="text-xl font-semibold text-amber-900">
            Aperçu : {cleanName(name)}
          </h1>
          {!loading && !error && url && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                className="px-3 py-1.5 rounded bg-amber-900 text-white hover:bg-amber-800 transition"
                onClick={() => forceDownloadByUrl(url, cleanName(name))}
                title="Télécharger l’original"
              >
                Télécharger
              </button>
              <button
                className="px-3 py-1.5 rounded bg-amber-900 text-white hover:bg-amber-800 transition"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setToast("Lien copié.");
                  } catch {
                    setToast("Copie impossible — sélection manuelle.");
                  }
                  setTimeout(() => setToast(""), 1800);
                }}
                title="Copier le lien de partage"
              >
                Partager
              </button>
              {isAdmin && (
                <button
                  className="px-3 py-1.5 rounded bg-amber-900 text-white hover:bg-amber-800 transition"
                  onClick={() => setAccessOpen(true)}
                  title="Gérer les accès"
                >
                  Accès
                </button>
              )}
            </div>
          )}
        </div>

        {toast && <div className="mb-2 text-sm text-green-700">{toast}</div>}

        {loading && <div className="p-4">Chargement…</div>}
        {error && <div className="text-red-600 p-4">{error}</div>}

        {!loading && !error && (
          <div
            className={`w-full rounded-xl overflow-hidden ${
              kind === "image" ? "" : "bg-white border border-gray-200 shadow"
            }`}
            style={{ minHeight: "auto" }}
          >
            {kind === "pdf" && url && (
              <iframe
                title={name}
                src={url}
                className="w-full"
                style={{ minHeight: "auto" }}
              />
            )}
            {kind === "image" && url && (
              <div className="w-full h-full flex items-center justify-center p-2 bg-transparent">
                <img
                  src={url}
                  alt={name}
                  className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-xl ring-1 ring-black/10"
                />
              </div>
            )}
            {kind === "video" && url && (
              <video
                src={url}
                controls
                className="w-full"
                style={{ minHeight: "auto" }}
              />
            )}
            {kind === "office" && (
              <div className="w-full h-full bg-white">
                {pdfUrl ? (
                  <iframe
                    title={name}
                    src={pdfUrl}
                    className="w-full"
                    style={{ minHeight: "auto" }}
                  />
                ) : url ? (
                  <>
                    <div className="flex items-center gap-2 p-2 border-b text-sm bg-gray-50">
                      <span className="text-gray-600">
                        Si l'aperçu n'est pas disponible:
                      </span>
                      <a
                        className="px-2 py-1 rounded bg-amber-900 text-white hover:bg-amber-800 transition"
                        href={googleHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          e.preventDefault();
                          openGoogleViewerWithRetries();
                        }}
                      >
                        ouvrir dans Google Viewer
                      </a>
                    </div>
                    <iframe
                      title={name}
                      src={msSrc}
                      className="w-full"
                      style={{ minHeight: "75vh" }}
                    />
                  </>
                ) : (
                  <div className="p-4 text-gray-500">Préparation…</div>
                )}
              </div>
            )}
            {kind === "other" && url && (
              <div className="p-6 text-center text-gray-600">
                Aperçu indisponible pour ce type de fichier.
                <div className="mt-3">
                  <a
                    className="btn-primary"
                    href={url}
                    download={cleanName(name)}
                  >
                    Télécharger
                  </a>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Infos d'accès — placé juste après l’aperçu */}
        {!loading && !error && (
          <div className="mt-3 text-sm text-gray-600 bg-gray-50 rounded p-3 border">
            <div>
              <b>Visibilité :</b> {isPublic ? "Public" : "Privé"}
            </div>
            <div>
              <b>Propriétaire :</b> {ownerEmail || "—"}
            </div>
            <div className="break-words">
              <b>E-mails autorisés :</b>{" "}
              {emails?.trim() ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {emails
                    .split(/[\s,;]+/)
                    .map((e) => e.trim())
                    .filter(Boolean)
                    .map((e) => (
                      <span
                        key={e}
                        className="px-2 py-0.5 rounded-full border border-amber-900/40 text-amber-900 bg-amber-50 text-xs"
                        title={e}
                      >
                        {e}
                      </span>
                    ))}
                </div>
              ) : (
                "—"
              )}
            </div>
          </div>
        )}

        {/* Infos d'accès déjà affichées au-dessus pour une meilleure visibilité sur mobile */}

        <Modal
          open={accessOpen}
          title={`Accès : ${cleanName(name)}`}
          onClose={() => setAccessOpen(false)}
        >
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              Rendre public
            </label>
            <div>
              <div className="text-sm text-gray-600 mb-1">
                E-mails autorisés
              </div>
              {emailList.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {emailList.map((e) => (
                    <span
                      key={e}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-amber-900/40 text-amber-900 bg-amber-50 text-xs"
                    >
                      {e}
                      <button
                        type="button"
                        className="ml-1 text-amber-900/70 hover:text-amber-900"
                        onClick={() =>
                          setEmailList((list) => list.filter((x) => x !== e))
                        }
                        aria-label={`Retirer ${e}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <input
                className="input w-full"
                value={pendingEmail}
                onChange={(e) => setPendingEmail(e.target.value)}
                placeholder="Ajouter un e-mail (ex: alice@ex.com)"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setAccessOpen(false)}>
                Annuler
              </button>
              <button
                className="btn-primary"
                onClick={async () => {
                  try {
                    // Construire la liste finale à sauvegarder
                    const clean = (s) => (s || "").trim().toLowerCase();
                    let base = emailList.map(clean).filter(Boolean);
                    const extra = clean(pendingEmail);
                    if (extra && !base.includes(extra)) base = [...base, extra];
                    // Mettre aussi à jour l'état "emails" pour l'affichage en lecture seule
                    setEmails(base.join(", "));

                    const id = btoa(
                      unescape(
                        encodeURIComponent(
                          fullPath.endsWith("/") || fullPath.includes(".")
                            ? fullPath
                            : fullPath + "/"
                        )
                      )
                    )
                      .replace(/\+/g, "-")
                      .replace(/\//g, "_")
                      .replace(/=+$/g, "");
                    const payload = {
                      file_path:
                        fullPath.endsWith("/") || fullPath.includes(".")
                          ? fullPath
                          : fullPath + "/",
                      is_public: isPublic,
                      allowed_emails: base,
                      owner_email: me,
                      updated_at: serverTimestamp(),
                    };
                    await setDoc(doc(db, "metas", id), payload, {
                      merge: true,
                    });
                    setToast("Accès mis à jour.");
                    setAccessOpen(false);
                    setPendingEmail("");
                    try {
                      await logActivity(db, auth.currentUser, {
                        action: "update_access",
                        target: fullPath,
                      });
                    } catch {}
                    setTimeout(() => setToast(""), 2000);
                  } catch (e) {
                    setToast("Échec de la mise à jour des accès.");
                    setTimeout(() => setToast(""), 2000);
                  }
                }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
