import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import { sendUserApproved } from "../lib/email";

export default function Demandes() {
  const [items, setItems] = useState([]);
  const [working, setWorking] = useState("");

  useEffect(() => {
    (async () => {
      const snap = await getDocs(collection(db, "user_profiles"));
      const rows = snap.docs
        .map((d) => d.data())
        .filter((x) => x.approved === false);
      setItems(rows);
    })();
  }, []);

  async function approve(row) {
    if (
      !window.confirm(
        `Valider l'inscription de ${row.displayName || row.email} ?`
      )
    )
      return;
    setWorking(row.uid);
    try {
      await setDoc(
        doc(db, "user_profiles", row.uid),
        { approved: true },
        { merge: true }
      );

      await sendUserApproved({
        toEmail: row.email,
        toName: row.displayName || row.email,
        appName: "TelimanShare",
        loginUrl: `${window.location.origin}/signin`,
      });

      setItems((prev) => prev.filter((x) => x.uid !== row.uid));
    } catch (e) {
      console.error(e);
      alert("Échec de l’approbation : " + (e?.message || e));
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="mx-auto max-w-3xl w-[92%] py-8">
      <h1 className="text-2xl font-bold mb-4">Demandes d’inscription</h1>
      {items.length === 0 && (
        <div className="p-4 bg-white rounded border">
          Aucune demande en attente.
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((row) => (
          <li key={row.uid} className="bg-white rounded-xl border p-4">
            <div className="font-semibold">{row.displayName || "—"}</div>
            <div className="text-sm text-gray-600">{row.email}</div>
            <button
              className="mt-3 px-4 py-2 rounded bg-amber-900 text-white hover:bg-amber-800 disabled:opacity-50"
              onClick={() => approve(row)}
              disabled={working === row.uid}
            >
              {working === row.uid ? "Validation…" : "Valider l’inscription"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
