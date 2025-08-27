import { useState } from "react";
import { auth } from "../../firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form
      onSubmit={handleSignUp}
      className="flex flex-col gap-4 max-w-sm mx-auto p-6"
    >
      <h2 className="text-2xl font-bold text-green-900 text-center">
        S'inscrire
      </h2>
      <input
        className="input border-2 border-blue-200 focus:border-blue-400 transition p-2 rounded w-full"
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        className="input border-2 border-blue-200 focus:border-blue-400 transition p-2 rounded w-full"
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button className="btn-primary" type="submit">
        S'inscrire
      </button>
      {error && <div className="text-red-600 text-center">{error}</div>}
    </form>
  );
}
