import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(error.message);
      } else {
        alert("Something went wrong");
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6
    bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200">

      <form
        onSubmit={handleLogin}
        className="w-full max-w-xs space-y-5
        bg-white/50 backdrop-blur-xl
        border border-white/40
        shadow-2xl rounded-2xl p-8"
      >
        <h2 className="text-2xl font-bold text-center text-slate-700">
          Welcome Back
        </h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded-lg
          bg-white/60 border border-white/50
          focus:outline-none focus:ring-2 focus:ring-purple-300"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 rounded-lg
          bg-white/60 border border-white/50
          focus:outline-none focus:ring-2 focus:ring-purple-300"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full py-2 rounded-lg font-semibold
          bg-gradient-to-r from-purple-400 to-indigo-400
          text-white shadow-md
          hover:scale-105 transition"
        >
          Login
        </button>

        <p
          className="text-sm text-center cursor-pointer text-slate-600 hover:text-slate-800"
          onClick={() => navigate("/signup")}
        >
          Don't have an account? Sign up
        </p>
      </form>
    </div>
  );
}