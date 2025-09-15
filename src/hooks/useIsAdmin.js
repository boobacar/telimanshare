import { useEffect, useState } from "react";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function useIsAdmin(user) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const email = (user?.email || "").toLowerCase();
        if (!email) {
          setIsAdmin(false);
          return;
        }
        const snap = await getDoc(doc(db, "admins", email));
        if (alive) setIsAdmin(snap.exists());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  return { isAdmin, loading };
}
