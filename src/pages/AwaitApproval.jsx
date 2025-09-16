// src/pages/AwaitApproval.jsx
import { auth } from "../firebase";
import { signOut } from "firebase/auth";

export default function AwaitApproval() {
  return (
    <div className="max-w-lg mx-auto p-6 text-center">
      <h1 className="text-2xl font-semibold mb-3 text-amber-900">
        Inscription en attente de validation
      </h1>
      <p className="text-gray-700">
        Votre inscription a bien été prise en compte. Vous recevrez un e-mail
        dès qu’un administrateur l’aura validée. Merci de votre patience.
      </p>
      <button
        className="mt-6 px-4 py-2 rounded bg-amber-900 text-white hover:bg-amber-800"
        onClick={() => signOut(auth)}
      >
        Connexion
      </button>
    </div>
  );
}
