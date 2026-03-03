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
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center space-y-6">
      <h1 className="text-3xl font-bold">Welcome to Ember</h1>
      <p className="text-gray-400">{user?.email}</p>

      <div className="space-y-4 w-80">
        <button
          onClick={handleCreateRoom}
          className="w-full bg-amber-500 text-black p-2 rounded font-semibold"
        >
          Create Room
        </button>

        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            className="flex-1 p-2 rounded bg-neutral-800"
          />
          <button
            onClick={handleJoinRoom}
            className="bg-amber-500 text-black px-4 rounded"
          >
            Join
          </button>
        </div>

        <button
          onClick={handleLogout}
          className="w-full bg-red-500 p-2 rounded font-semibold"
        >
          Logout
        </button>
      </div>
    </div>
  );
}