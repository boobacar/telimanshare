// src/pages/Pending.jsx
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

export default function Pending() {
  const navigate = useNavigate();

  const onLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    } finally {
      navigate("/signin", { replace: true });
    }
  };

  return (
    <>
      <header className="h-14 flex items-center justify-between px-3 sm:px-6 bg-green-900 text-white shadow">
        <div className="flex items-center gap-2">
          <img className="h-10" src={logo} alt="Teliman Logistique" />
        </div>
      </header>
      <div className="min-h-[88vh] w-full flex items-center justify-center bg-[url('/bg.jpg')] bg-cover bg-center">
        <div className="max-w-xl w-[92%] sm:w-[520px] bg-white/90 rounded-xl shadow border p-6 text-center">
          <h1 className="text-2xl font-bold text-amber-900">
            Inscription en attente de validation
          </h1>
          <p className="text-gray-700 mt-3">
            Votre inscription a bien été prise en compte. Vous recevrez un
            e-mail dès qu’un administrateur l’aura validée. Merci de votre
            patience.
          </p>
          <button
            className="mt-5 px-4 py-2 rounded bg-amber-900 text-white font-semibold hover:bg-amber-800"
            onClick={onLogout}
          >
            Se déconnecter
          </button>
        </div>
      </div>
    </>
  );
}
