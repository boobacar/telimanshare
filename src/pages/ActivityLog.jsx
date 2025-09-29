// src/pages/ActivityLog.jsx
import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";

function pad2(n) {
  return String(n).padStart(2, "0");
}
function fmt(d) {
  try {
    const dt = d?.toDate ? d.toDate() : d instanceof Date ? d : new Date(d);
    if (isNaN(dt.getTime())) return "—";
    const dd = pad2(dt.getDate());
    const mm = pad2(dt.getMonth() + 1);
    const yyyy = dt.getFullYear();
    const HH = pad2(dt.getHours());
    const MM = pad2(dt.getMinutes());
    const SS = pad2(dt.getSeconds());
    return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
  } catch {
    return "—";
  }
}

export default function ActivityLog() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "activity_logs"),
          orderBy("ts", "desc"),
          limit(200)
        );
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (alive) setRows(data);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => (alive = false);
  }, []);

  return (
    <div className="relative mx-auto max-w-screen-xl px-3 sm:px-4 pt-4 pb-8">
      <h1 className="text-xl font-semibold text-amber-900 mb-3">
        Journal d’activités
      </h1>
      {loading && <div className="text-gray-500">Chargement…</div>}
      {!loading && (
        <div className="overflow-x-auto bg-white rounded-sm border shadow">
          <table className="w-full text-sm">
            <thead className="bg-[#f3f2f1] text-[#323130]">
              <tr>
                <th className="text-left p-2">Quand</th>
                <th className="text-left p-2">Utilisateur</th>
                <th className="text-left p-2">Action</th>
                <th className="text-left p-2">Cible</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{fmt(r.ts)}</td>
                  <td className="p-2">{r.actor_email || "—"}</td>
                  <td className="p-2">{r.action}</td>
                  <td className="p-2 max-w-[360px] truncate">
                    {Array.isArray(r.target)
                      ? r.target.join(", ")
                      : r.target || "—"}
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
