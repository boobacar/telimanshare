import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { Trash2 } from "lucide-react";

/**
 * Commentaires par fichier (filePath).
 * L'auteur est saisi par l'utilisateur et mémorisé en localStorage.
 * NB: la vérification "seul l'auteur peut supprimer" est côté client.
 * Pour une sécurité totale, il faudra des policies RLS et un UID vérifié côté serveur.
 */
export default function Comments({ filePath }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [author, setAuthor] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Charger commentaires
  useEffect(() => {
    if (!filePath) return;
    let mounted = true;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("file_path", filePath)
        .order("created_at", { ascending: true });

      if (mounted) {
        setComments(data || []);
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [filePath]);

  // Charger l'auteur depuis localStorage
  useEffect(() => {
    setAuthor(localStorage.getItem("comment-author") || "");
  }, []);

  function handleAuthorChange(e) {
    const v = e.target.value;
    setAuthor(v);
    localStorage.setItem("comment-author", v);
  }

  // Ajouter un commentaire
  async function handleSubmit(e) {
    e.preventDefault();
    const content = newComment.trim();
    const who = author.trim();
    if (!content || !who) return;

    setPosting(true);

    // UI optimiste
    const tmpId = `tmp-${Date.now()}`;
    const optimistic = {
      id: tmpId,
      file_path: filePath,
      content,
      author: who,
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, optimistic]);
    setNewComment("");

    const { data, error } = await supabase
      .from("comments")
      .insert([{ file_path: filePath, content, author: who }])
      .select()
      .single();

    if (error) {
      // rollback
      setComments((prev) => prev.filter((c) => c.id !== tmpId));
    } else {
      // remplace le temporaire
      setComments((prev) => prev.map((c) => (c.id === tmpId ? data : c)));
    }
    setPosting(false);
  }

  // Supprimer un commentaire (par son auteur)
  async function handleDeleteComment(id) {
    const com = comments.find((c) => c.id === id);
    if (!com) return;

    // Vérif côté client: l'auteur courant doit correspondre
    if ((com.author || "").trim() !== (author || "").trim()) return;

    setDeletingId(id);

    // UI optimiste
    const backup = comments;
    setComments((prev) => prev.filter((c) => c.id !== id));

    const { error } = await supabase.from("comments").delete().eq("id", id);
    if (error) {
      // rollback si erreur
      setComments(backup);
    }
    setDeletingId(null);
  }

  return (
    <div className="mt-6">
      <div className="font-semibold mb-2 text-gray-600">Commentaires</div>

      <div className="max-h-48 overflow-y-auto mb-3 pr-1 space-y-1">
        {loading ? (
          <div className="text-gray-400 italic">Chargement…</div>
        ) : comments.length === 0 ? (
          <div className="text-gray-400 italic">Aucun commentaire</div>
        ) : (
          comments.map((com) => {
            const isMine = (com.author || "").trim() === (author || "").trim();
            return (
              <div
                key={com.id}
                className="bg-gray-50 border border-gray-200 rounded px-2 py-1.5 text-sm flex items-start gap-2"
              >
                <div className="flex-1">
                  <div>
                    <b className="text-blue-700">{com.author || "?"}</b>{" "}
                    <span className="text-gray-800">{com.content}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(com.created_at).toLocaleString()}
                  </div>
                </div>

                {isMine && (
                  <button
                    className="shrink-0 text-gray-400 hover:text-red-600 transition"
                    title="Supprimer mon commentaire"
                    onClick={() => handleDeleteComment(com.id)}
                    disabled={deletingId === com.id}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <input
          className="input"
          placeholder="Votre nom (auteur)"
          value={author}
          onChange={handleAuthorChange}
          disabled={posting}
          required
        />
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Ajouter un commentaire…"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={posting}
            required
          />
          <button
            className="btn-primary px-4 py-2"
            disabled={!newComment.trim() || !author.trim() || posting}
          >
            Envoyer
          </button>
        </div>
      </form>
    </div>
  );
}
