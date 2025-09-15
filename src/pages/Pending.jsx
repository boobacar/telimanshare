import { signOut } from "firebase/auth";
import { auth } from "../firebase";

export default function Pending() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[url('/bg.jpg')] bg-cover bg-center">
      <div className="max-w-xl w-[92%] sm:w-[520px] bg-white/90 rounded-xl shadow border p-6 text-center">
        <h1 className="text-2xl font-bold text-amber-900">
          Inscription en attente de validation
        </h1>
        <p className="text-gray-700 mt-3">
          Votre inscription a bien été prise en compte. Vous recevrez un e-mail
          dès qu’un administrateur l’aura validée. Merci de votre patience.
        </p>
        <button
          className="mt-5 px-4 py-2 rounded bg-amber-900 text-white font-semibold hover:bg-amber-800"
          onClick={() => signOut(auth)}
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
