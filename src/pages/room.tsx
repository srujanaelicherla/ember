import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc,
  getDoc,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useauth";
import { useTimer } from "../hooks/useTimer";

interface Member {
  id: string;
  email: string;
}

interface Task {
  id: string;
  text: string;
  isCompleted: boolean;
  createdBy: string;
  createdAt: string;
}

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const {
    mode,
    timeLeft,
    isRunning,
    durations,
    startTimer,
    pauseTimer,
    resetTimer,
    switchMode,
    updateSettings,
  } = useTimer(roomId);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");

  const [fInput, setFInput] = useState("25");
  const [bInput, setBInput] = useState("5");

  // Sync UI inputs with timer durations
  useEffect(() => {
    setFInput(Math.floor(durations.focus / 60).toString());
    setBInput(Math.floor(durations.break / 60).toString());
  }, [durations]);

  useEffect(() => {
    async function checkRoom() {
      if (!roomId) return;
      const snapshot = await getDoc(doc(db, "rooms", roomId));
      if (!snapshot.exists()) {
        navigate("/dashboard");
        return;
      }
      setLoading(false);
    }
    checkRoom();
  }, [roomId, navigate]);

  // Add user as member
  useEffect(() => {
    if (!roomId || !user) return;

    const memberRef = doc(db, "rooms", roomId, "members", user.uid);
    setDoc(memberRef, { email: user.email, joinedAt: new Date() });

    return () => {
      deleteDoc(memberRef).catch(() => {});
    };
  }, [roomId, user]);

  // Realtime listeners
  useEffect(() => {
    if (!roomId) return;

    const unsubMembers = onSnapshot(
      collection(db, "rooms", roomId, "members"),
      (snapshot) => {
        setMembers(
          snapshot.docs.map(
            (d) =>
              ({
                id: d.id,
                email: d.data().email,
              } as Member)
          )
        );
      }
    );

    const unsubTasks = onSnapshot(
      collection(db, "rooms", roomId, "tasks"),
      (snapshot) => {
        setTasks(
          snapshot.docs.map(
            (d) =>
              ({
                id: d.id,
                ...d.data(),
              } as Task)
          )
        );
      }
    );

    return () => {
      unsubMembers();
      unsubTasks();
    };
  }, [roomId]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading)
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-500 font-mono text-xs tracking-widest uppercase italic">
        Establishing Connection...
      </div>
    );

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 p-8">
      {/* TIMER */}
    <div className="flex flex-col items-center justify-center bg-stone-900 border border-stone-800 rounded-xl p-8 mb-12 shadow-2xl max-w-2xl mx-auto">
      <div className="text-sm uppercase tracking-widest text-stone-400 mb-2">
        {mode}
      </div>

      <div className="text-8xl font-mono font-bold text-white mb-8">
        {formatTime(timeLeft)}
      </div>

      {!isRunning && (
        <div className="flex gap-10 mb-8">
          <div className="flex flex-col items-center">
            <span className="text-xs text-stone-400 mb-2">Focus</span>
            <input
              type="number"
              min={1}
              value={fInput}
              onChange={(e) => setFInput(e.target.value)}
              onBlur={() => {
                const val = Math.max(1, parseInt(fInput) || 25);
                setFInput(val.toString());
                updateSettings(val, parseInt(bInput) || 5);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="w-16 text-center bg-stone-800 rounded p-2"
            />
          </div>

          <div className="flex flex-col items-center">
            <span className="text-xs text-stone-400 mb-2">Break</span>
            <input
              type="number"
              min={1}
              value={bInput}
              onChange={(e) => setBInput(e.target.value)}
              onBlur={() => {
                const val = Math.max(1, parseInt(bInput) || 5);
                setBInput(val.toString());
                updateSettings(parseInt(fInput) || 25, val);
              }}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              className="w-16 text-center bg-stone-800 rounded p-2"
            />
          </div>
        </div>
      )}

      <div className="flex gap-6 items-center">
        <button
          onClick={() => (isRunning ? pauseTimer() : startTimer())}
          className="w-16 h-16 rounded-full bg-[#556b2f] text-white text-2xl flex items-center justify-center"
        >
          {isRunning ? "❚❚" : "▶"}
        </button>

        <button
          onClick={() => resetTimer()}
          className="w-12 h-12 rounded-full bg-stone-700 text-white text-xl flex items-center justify-center"
        >
          ⟳
        </button>

        <button
          onClick={() => switchMode()}
          className="px-6 py-3 rounded-full bg-stone-700 text-white"
        >
          {mode === "Focus" ? "Break" : "Focus"}
        </button>
      </div>
    </div>

      {/* 👥 MEMBER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {members.map((member) => {
          const isMe = member.id === user?.uid;
          const memberTasks = tasks.filter(
            (t) => t.createdBy === member.email
          );

          const progress =
            memberTasks.length === 0
              ? 0
              : Math.round(
                  (memberTasks.filter((t) => t.isCompleted).length /
                    memberTasks.length) *
                    100
                );

          return (
            <div
              key={member.id}
              className="bg-stone-900 rounded-xl border border-stone-800 overflow-hidden shadow-xl flex flex-col h-[420px]"
            >
              <div className="bg-[#556b2f] p-4 flex justify-between items-center">
                <h3 className="text-xs font-bold text-white truncate max-w-[120px]">
                  {member.email?.split("@")[0]} {isMe && "(You)"}
                </h3>
                <div className="w-20 text-[10px] text-white font-bold text-center">
                  {progress}%
                </div>
              </div>

              <div className="p-5 flex-1 overflow-y-auto bg-stone-900/20">
                <ul className="space-y-2">
                  {memberTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={t.isCompleted}
                        disabled={!isMe}
                        onChange={() =>
                          updateDoc(
                            doc(db, "rooms", roomId!, "tasks", t.id),
                            { isCompleted: !t.isCompleted }
                          )
                        }
                      />
                      <span
                        className={
                          t.isCompleted
                            ? "line-through text-stone-600"
                            : ""
                        }
                      >
                        {t.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {isMe && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newTaskInput.trim()) return;

                    addDoc(collection(db, "rooms", roomId!, "tasks"), {
                      text: newTaskInput,
                      isCompleted: false,
                      createdBy: user.email,
                      createdAt: new Date().toISOString(),
                    });

                    setNewTaskInput("");
                  }}
                  className="p-4 border-t border-stone-800 flex gap-2"
                >
                  <input
                    type="text"
                    value={newTaskInput}
                    onChange={(e) => setNewTaskInput(e.target.value)}
                    placeholder="Add task..."
                    className="flex-1 bg-stone-800 text-xs p-2 rounded"
                  />
                  <button className="bg-stone-700 px-3 rounded">
                    +
                  </button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}