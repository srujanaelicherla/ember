import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useauth";
import { addDoc, collection } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [roomCode, setRoomCode] = useState("");

  async function handleLogout() {
    await signOut(auth);
    navigate("/");
  }

  async function handleCreateRoom() {
    if (!user) return;

    const docRef = await addDoc(collection(db, "rooms"), {
      createdBy: user.uid,
      createdAt: new Date(),
    });

    navigate(`/room/${docRef.id}`);
  }

  function handleJoinRoom() {
    if (!roomCode.trim()) return;
    navigate(`/room/${roomCode}`);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6
    bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200">

      <div
        className="w-full max-w-sm space-y-6 text-center
        bg-white/50 backdrop-blur-xl
        border border-white/40
        shadow-2xl rounded-2xl p-8"
      >
        <h1 className="text-3xl font-bold text-slate-700">
          Welcome to Ember
        </h1>

        <p className="text-slate-600 text-sm">{user?.email}</p>

        <div className="space-y-4">

          <button
            onClick={handleCreateRoom}
            className="w-full py-2 rounded-lg font-semibold
            bg-gradient-to-r from-purple-400 to-indigo-400
            text-white shadow-md hover:scale-105 transition"
          >
            Create Room
          </button>

          <div className="flex space-x-2">

            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              className="flex-1 p-2 rounded-lg
              bg-white/60 border border-white/50
              focus:outline-none focus:ring-2 focus:ring-purple-300"
            />

            <button
              onClick={handleJoinRoom}
              className="px-4 rounded-lg
              bg-gradient-to-r from-purple-400 to-indigo-400
              text-white shadow hover:scale-105 transition"
            >
              Join
            </button>

          </div>

          <button
            onClick={handleLogout}
            className="w-full py-2 rounded-lg font-semibold
            bg-white/60 border border-white/40
            text-slate-700 hover:bg-white/80 transition"
          >
            Logout
          </button>

        </div>
      </div>

    </div>
  );
}