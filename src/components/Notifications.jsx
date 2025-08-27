import { useEffect, useState } from "react";
import { supabase } from "../supabase";

export default function Notifications({ user }) {
  const [list, setList] = useState([]);
  useEffect(() => {
    async function fetchNotif() {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .or(`recipient.eq.all,recipient.eq.${user.email}`)
        .order("created_at", { ascending: false });
      setList(data || []);
    }
    if (user) fetchNotif();
  }, [user]);

  return (
    <div className="max-w-md mx-auto p-4">
      <h3 className="font-bold text-lg mb-2">Notifications</h3>
      <ul>
        {list.map((notif) => (
          <li
            key={notif.id}
            className={`p-2 rounded mb-1 ${
              notif.read ? "bg-gray-100" : "bg-blue-50 font-semibold"
            }`}
          >
            <span>{notif.message}</span>
            {notif.link && (
              <a
                href={notif.link}
                className="ml-2 text-blue-700 underline text-xs"
              >
                Voir
              </a>
            )}
            <span className="float-right text-xs text-gray-500">
              {new Date(notif.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
