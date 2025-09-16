import { useState } from "react";
import { auth } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSignIn = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
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
      <input
        className="input border-2 border-green-800 focus:border-green-900 transition p-2 rounded w-full"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="input border-2 border-green-800 focus:border-green-900 transition p-2 rounded w-full"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="btn-primary" type="submit">
        Se Connecter
      </button>
      {error && <div className="text-red-600 text-center">{error}</div>}
    </form>
  );
}
