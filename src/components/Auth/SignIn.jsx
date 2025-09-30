import { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [savedEmails, setSavedEmails] = useState([]);
  const [showEmailList, setShowEmailList] = useState(false);
  const navigate = useNavigate();

  const STORAGE_KEY = "teliman_saved_emails";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      if (Array.isArray(arr)) setSavedEmails(arr);
    } catch {}
  }, []);

  const saveEmail = (e) => {
    const norm = (e || "").trim().toLowerCase();
    if (!norm) return;
    setSavedEmails((prev) => {
      const next = [norm, ...prev.filter((x) => x !== norm)].slice(0, 8);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const filteredEmails = useMemo(() => {
    const v = (email || "").toLowerCase();
    if (!v) return savedEmails;
    return savedEmails.filter((x) => x.includes(v));
  }, [email, savedEmails]);

  const emailBoxRef = useRef(null);
  useEffect(() => {
    const onClickOutside = (e) => {
      if (!emailBoxRef.current) return;
      if (!emailBoxRef.current.contains(e.target)) setShowEmailList(false);
    };
    document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, []);

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      saveEmail(email);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form
      onSubmit={handleSignIn}
      className="flex flex-col gap-4 max-w-sm mx-auto p-6 border rounded-xl my-[30vh]"
    >
      <h2 className="text-2xl text-green-900 font-bold text-center">
        Se Connecter
      </h2>
      <div className="relative" ref={emailBoxRef}>
        <input
          className="input border-2 border-green-800 focus:border-green-900 transition p-2 rounded w-full"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (savedEmails.length) setShowEmailList(true);
          }}
          onFocus={() => savedEmails.length && setShowEmailList(true)}
          required
          autoComplete="email username"
        />
        {showEmailList && filteredEmails.length > 0 && (
          <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow max-h-48 overflow-auto">
            {filteredEmails.map((em) => (
              <button
                type="button"
                key={em}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setEmail(em);
                  setShowEmailList(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-green-50"
              >
                {em}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <input
          className="input border-2 border-green-800 focus:border-green-900 transition p-2 rounded w-full pr-10"
          type={showPwd ? "text" : "password"}
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() => setShowPwd((s) => !s)}
          className="absolute inset-y-0 right-2 flex items-center text-gray-600 hover:text-gray-800"
          aria-label={
            showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
        >
          {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      <button className="btn-primary" type="submit">
        Se Connecter
      </button>
      {error && (
        <div className="text-red-600 text-center">
          {error === "Firebase: Error (auth/invalid-credential)."
            ? "Email ou mot de passe incorrecte."
            : error}
        </div>
      )}
    </form>
  );
}
