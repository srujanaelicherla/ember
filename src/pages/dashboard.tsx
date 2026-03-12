import { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useauth";
import {
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  collectionGroup,
  doc,
  deleteDoc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";

interface RecentRoom {
  id: string;
  name?: string;
  createdBy?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [recentRooms, setRecentRooms] = useState<RecentRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  // State for Custom Modal
  const [roomToDelete, setRoomToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collectionGroup(db, "members"),
      where("email", "==", user.email),
    );

    const unsub = onSnapshot(
      q,
      { includeMetadataChanges: true },
      async (snapshot) => {
        if (snapshot.empty) {
          setRecentRooms([]);
          setLoadingRooms(false);
          return;
        }

        const roomIds = snapshot.docs
          .map((d) => d.ref.parent.parent?.id)
          .filter(Boolean) as string[];

        const uniqueIds = Array.from(new Set(roomIds));

        const roomDetailsPromises = uniqueIds.map(async (id) => {
          try {
            const roomSnap = await getDoc(doc(db, "rooms", id));
            if (!roomSnap.exists()) return null;

            const roomData = roomSnap.data();
            return {
              id,
              name: roomData.name || "Untitled Room",
              createdBy: roomData.createdBy,
            } as RecentRoom;
          } catch (error) {
            console.error(error);
            return null;
          }
        });

        const results = await Promise.all(roomDetailsPromises);
        const validRooms = results.filter((r): r is RecentRoom => r !== null);

        setRecentRooms(validRooms);
        setLoadingRooms(false);
      },
    );

    return () => unsub();
  }, [user]);

  // Handle Leaving a room (No modal needed usually, just instant)
  const handleLeaveRoom = async (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    if (!user) return;
    try {
      setRecentRooms((prev) => prev.filter((r) => r.id !== roomId));
      await deleteDoc(doc(db, "rooms", roomId, "members", user.uid));
    } catch (error) {
      console.error(error);
    }
  };

  // Open custom modal instead of window.confirm
  const openDeleteModal = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    setRoomToDelete(roomId);
  };

  // Finalize deletion from modal
  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    try {
      const id = roomToDelete;
      setRoomToDelete(null); // Close modal
      setRecentRooms((prev) => prev.filter((r) => r.id !== id));
      await deleteDoc(doc(db, "rooms", id));
    } catch (error) {
      console.error(error);
    }
  };

  async function handleCreateRoom() {
    if (!user) return;
    try {
      const roomRef = await addDoc(collection(db, "rooms"), {
        createdBy: user.uid,
        createdAt: new Date(),
        name: "New Study Room",
      });
      navigate(`/room/${roomRef.id}`);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200">
      {/* MAIN ACTION CARD */}
      <div className="w-full max-w-sm space-y-6 text-center bg-white/50 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl p-8 mb-10">
        <h1 className="text-3xl font-bold text-slate-700">Welcome to Ember</h1>
        <p className="text-slate-600 text-sm truncate">{user?.email}</p>

        <div className="space-y-4">
          <button
            onClick={handleCreateRoom}
            className="w-full py-2 rounded-lg font-semibold bg-gradient-to-r from-purple-400 to-indigo-400 text-white shadow-md hover:scale-105 transition"
          >
            Create Room
          </button>
          <div className="flex space-x-2">
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              // ADDED text-slate-700 to fix the white text issue
              className="flex-1 p-2 rounded-lg bg-white/60 border border-white/50 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-purple-300 placeholder:text-slate-400"
            />
            <button
              onClick={() => {
                if (!roomCode.trim()) return;
                navigate(`/room/${roomCode.trim()}`);
              }}
              className="px-4 rounded-lg bg-gradient-to-r from-purple-400 to-indigo-400 text-white font-bold shadow hover:scale-105 transition"
            >
              Join
            </button>
          </div>
          <button
            onClick={() => signOut(auth)}
            className="w-full py-2 rounded-lg font-semibold bg-white/60 border border-white/40 text-slate-700 hover:bg-white/80 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* RECENT ROOMS GRID */}
      <div className="w-full max-w-4xl space-y-4">
        {recentRooms.length > 0 && (
          <>
            <h2 className="text-xl font-bold text-slate-700 ml-2">
              Recent Rooms
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentRooms.map((room) => {
                const isOwner = room.createdBy === user?.uid;
                return (
                  <div
                    key={room.id}
                    onClick={() => navigate(`/room/${room.id}`)}
                    className="p-5 bg-white/40 backdrop-blur-md border border-white/50 rounded-xl shadow-lg cursor-pointer hover:bg-white/60 transition group relative"
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                        {isOwner ? "⭐ Owner" : "Member"}
                      </span>
                      <button
                        onClick={(e) =>
                          isOwner
                            ? openDeleteModal(e, room.id)
                            : handleLeaveRoom(e, room.id)
                        }
                        className="text-slate-400 hover:text-red-500 transition font-bold text-sm"
                      >
                        ✕
                      </button>
                    </div>
                    <h3 className="font-bold text-slate-700 mt-2 truncate">
                      {room.name}
                    </h3>
                    <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase truncate">
                      {room.id}
                    </p>
                    <div className="text-right mt-3">
                      <span className="text-xs font-bold text-indigo-400 group-hover:underline">
                        Rejoin →
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {loadingRooms && (
          <p className="text-center text-slate-500 text-sm animate-pulse">
            Checking history...
          </p>
        )}
      </div>

      {/* CUSTOM DELETE MODAL */}
      {roomToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm">
          <div className="w-full max-w-xs bg-white/90 backdrop-blur-2xl border border-white shadow-2xl rounded-2xl p-6 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 text-xl">
              ⚠️
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-2">
              Delete Room?
            </h3>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              This will remove the room and all tasks for everyone. This cannot
              be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRoomToDelete(null)}
                className="flex-1 py-2 rounded-lg font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRoom}
                className="flex-1 py-2 rounded-lg font-semibold bg-red-500 text-white hover:bg-red-600 shadow-md shadow-red-200 transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
