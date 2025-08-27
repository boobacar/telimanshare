import { Link } from "react-router-dom";
import { Folder, Users } from "lucide-react";

export default function Dashboard({ user }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 min-h-[calc(100vh-60px)]">
      <div className="bg-white border border-gray-200 rounded-2xl shadow p-8 w-full max-w-xl flex flex-col items-center">
        <h1 className="text-3xl font-bold text-amber-900 mb-3">
          Bienvenue sur Teliman Share
        </h1>
        <p className="text-gray-700 text-center mb-8">
          Partagez, gérez et retrouvez tous vos fichiers d’équipe facilement.
          <br />
          Accédez à vos documents depuis n’importe où.
        </p>
        <div className="flex gap-4">
          <Link
            to="/documents"
            className="flex items-center gap-2 px-5 py-2 rounded bg-amber-900 text-white font-semibold hover:bg-blue-700 shadow"
          >
            <Folder size={20} /> Documents
          </Link>
          {/* <Link
            to="/shared"
            className="flex items-center gap-2 px-5 py-2 rounded bg-[#e5f1fb] text-amber-900 font-semibold hover:bg-[#cce6fa] shadow"
          >
            <Users size={20} /> Partagés avec moi
          </Link> */}
        </div>
      </div>
    </div>
  );
}
