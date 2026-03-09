import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();

    try {
      await createUserWithEmailAndPassword(auth, email, password);
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
    <div className="flex items-center justify-center min-h-screen bg-black text-white px-4">
      <form
        onSubmit={handleSignup}
        className="bg-neutral-900 p-8 rounded-xl w-full max-w-xs space-y-4"
      >
        <h2 className="text-2xl font-bold text-center">Create Ember Account</h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-neutral-800"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 rounded bg-neutral-800"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full bg-amber-500 text-black p-2 rounded font-semibold"
        >
          Sign Up
        </button>

        <p
          className="text-sm text-center cursor-pointer text-gray-400"
          onClick={() => navigate("/")}
        >
          Already have an account? Login
        </p>
      </form>
    </div>
  );
}