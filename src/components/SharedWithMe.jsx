import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../firebase";
import SharedTable from "../components/SharedTable";

export default function SharedWithMe() {
  const [user] = useAuthState(auth);
  const [sharedFiles, setSharedFiles] = useState([]);

  useEffect(() => {
    if (user) fetchShared();
  }, [user]);

  async function fetchShared() {
    // 1) Appel à la RPC
    const { data: shares, error } = await supabase.rpc("get_shared_with_me", {
      user_uid: user.uid,
    });
    if (error) {
      console.error("Erreur RPC get_shared_with_me:", error);
      return;
    }

    // 2) Pour chaque entrée, on génère l'URL publique
    const withUrls = shares.map((s) => {
      const { data: urlData } = supabase.storage
        .from("files")
        .getPublicUrl(s.file_path);
      return {
        ...s,
        public_url: urlData.publicUrl,
      };
    });

    setSharedFiles(withUrls);
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Partagés avec moi</h2>
      <SharedTable files={sharedFiles} />
    </div>
  );
}
