// src/pages/Trash.jsx
import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { storage } from "../firebase";
import { ref as sRef, listAll, getMetadata } from "firebase/storage";
import { restoreFile, deleteForever } from "../lib/trash";
import { logActivity } from "../lib/activityLog";
import ToastLite from "../components/ToastLite";

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso || "—";
  }
}

export default function Trash() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "" });

  const showToast = (msg) => setToast({ open: true, msg });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const acc = [];
      async function walk(prefix) {
        const res = await listAll(sRef(storage, prefix));
        for (const it of res.items) {
          const meta = await getMetadata(it).catch(() => null);
          const p = it.fullPath;
          const m = meta?.customMetadata || {};
          acc.push({
            trashPath: p,
            orig_path: m.orig_path || "",
            deleted_by: m.deleted_by || "",
            deleted_at: m.deleted_at || "",
            name: it.name,
            size: meta?.size || 0,
            contentType: meta?.contentType || "",
          });
        }
        for (const p of res.prefixes) await walk(p.fullPath);
      }
      await walk("trash");
      if (alive)
        setItems(acc.sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1)));
      setLoading(false);
    })();
    return () => (alive = false);
  }, []);

  async function restore(it) {
    try {
      await restoreFile(storage, it.trashPath);
      await logActivity(db, auth.currentUser, {
        action: "restore",
        target: it.orig_path,
      });
      setItems((arr) => arr.filter((x) => x.trashPath !== it.trashPath));
      showToast("Restauré.");
    } catch (e) {
      showToast("Restauration impossible.");
    }
  }

  async function destroy(it) {
    if (!window.confirm("Supprimer définitivement ?")) return;
    try {
      await deleteForever(storage, it.trashPath);
      await logActivity(db, auth.currentUser, {
        action: "delete_forever",
        target: it.orig_path,
      });
      setItems((arr) => arr.filter((x) => x.trashPath !== it.trashPath));
      showToast("Supprimé définitivement.");
    } catch (e) {
      showToast("Suppression impossible.");
    }
  }

  return (
    <div className="relative mx-auto max-w-screen-xl px-3 sm:px-4 pt-4 pb-8">
      <ToastLite
        open={toast.open}
        message={toast.msg}
        onClose={() => setToast({ open: false, msg: "" })}
      />
      <h1 className="text-xl font-semibold text-amber-900 mb-3">Corbeille</h1>
      {loading && <div className="text-gray-500">Chargement…</div>}
      {!loading && items.length === 0 && (
        <div className="text-gray-500">Aucun élément dans la corbeille.</div>
      )}
      {!loading && items.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-xl border shadow">
          <table className="w-full text-sm">
            <thead className="bg-[#f3f2f1] text-[#323130]">
              <tr>
                <th className="text-left p-2">Nom</th>
                <th className="text-left p-2">Chemin d’origine</th>
                <th className="text-left p-2">Supprimé par</th>
                <th className="text-left p-2">Quand</th>
                <th className="text-right p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.trashPath} className="border-t">
                  <td className="p-2">{it.name}</td>
                  <td className="p-2 font-mono text-xs truncate max-w-[240px]">
                    {it.orig_path || "—"}
                  </td>
                  <td className="p-2">{it.deleted_by || "—"}</td>
                  <td className="p-2">{formatDate(it.deleted_at)}</td>
                  <td className="p-2 text-right space-x-2">
                    <button className="btn" onClick={() => restore(it)}>
                      Restaurer
                    </button>
                    <button
                      className="p-1 px-2 m-2 rounded-lg bg-red-400 hover:bg-red-500"
                      onClick={() => destroy(it)}
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
