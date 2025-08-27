import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function DocumentMetaModal({ open, onClose, file, onSaved }) {
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState(""); // "tag1, tag2"

  useEffect(() => {
    if (!open || !file) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("documents_meta")
        .select("*")
        .eq("file_path", file.fullPath)
        .maybeSingle();

      if (mounted) {
        setDisplayName(data?.display_name ?? file.name.replace(/^\d+_/, ""));
        setDescription(data?.description ?? "");
        setTagsText((data?.tags ?? []).join(", "));
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [open, file]);

  async function handleSave(e) {
    e.preventDefault();
    setLoading(true);
    const tags = tagsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      file_path: file.fullPath,
      display_name: displayName || file.name.replace(/^\d+_/, ""),
      description,
      tags,
      owner_email: file.owner || null,
    };

    const { error } = await supabase
      .from("documents_meta")
      .upsert(payload, { onConflict: "file_path" });

    setLoading(false);
    if (!error) {
      onSaved?.(payload);
      onClose();
    } else {
      alert("Erreur sauvegarde méta: " + error.message);
    }
  }

  if (!open || !file) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-[92vw] max-w-lg rounded-xl shadow p-5">
        <div className="text-lg font-semibold mb-3">
          Métadonnées – {file.name.replace(/^\d+_/, "")}
        </div>
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Nom lisible
            </label>
            <input
              className="input w-full"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Description
            </label>
            <textarea
              className="input w-full min-h-[90px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexte, notes, références…"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Tags (séparés par des virgules)
            </label>
            <input
              className="input w-full"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              placeholder="contrat, facture, RH"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="btn"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
