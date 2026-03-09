import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import {
  doc,
  getDoc,
  collection,
  setDoc,
  deleteDoc,
  onSnapshot,
  addDoc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useauth";
import { useTimer } from "../hooks/useTimer";

interface Member {
  id: string;
  email: string | null;
}

interface Task {
  id: string;
  text: string;
  isCompleted: boolean;
  createdBy: string | null;
  createdAt: number;
}

interface ChatMessage {
  id: string;
  text: string;
  sender: string | null;
  createdAt: number;
}

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");
  const [copied, setCopied] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");

  const chatBottomRef = useRef<HTMLDivElement | null>(null);

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

  const [fInput, setFInput] = useState("25");
  const [bInput, setBInput] = useState("5");
  const prevProgressRef = useRef<number>(0);

  useEffect(() => {
    setFInput(Math.floor(durations.focus / 60).toString());
    setBInput(Math.floor(durations.break / 60).toString());
  }, [durations]);

  useEffect(() => {
    if (!user || tasks.length === 0) return;

    const myTasks = tasks.filter((t) => t.createdBy === user.email);
    const completed = myTasks.filter((t) => t.isCompleted).length;

    const currentProgress =
      myTasks.length === 0 ? 0 : (completed / myTasks.length) * 100;

    if (currentProgress >= 99.9 && prevProgressRef.current < 99.9) {
      confetti({
        particleCount: 200,
        spread: 160,
        origin: { y: 0.6 },
        colors: [
          "#FF0000",
          "#00FF00",
          "#0000FF",
          "#FFFF00",
          "#FF00FF",
          "#00FFFF",
        ],
      });
    }

    prevProgressRef.current = currentProgress;
  }, [tasks, user]);

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

  useEffect(() => {
    if (!roomId || !user) return;

    const memberRef = doc(db, "rooms", roomId, "members", user.uid);

    setDoc(memberRef, {
      email: user.email,
      joinedAt: new Date(),
    });

    return () => {
      deleteDoc(memberRef).catch(() => {});
    };
  }, [roomId, user]);

  useEffect(() => {
    if (!roomId) return;

    const unsubMembers = onSnapshot(
      collection(db, "rooms", roomId, "members"),
      (s) =>
        setMembers(
          s.docs.map((d) => ({ id: d.id, email: d.data().email }) as Member),
        ),
    );

    const tasksQuery = query(
      collection(db, "rooms", roomId, "tasks"),
      orderBy("createdAt", "desc"),
    );

    const unsubTasks = onSnapshot(tasksQuery, (s) =>
      setTasks(
        s.docs.map(
          (d) =>
            ({
              id: d.id,
              text: d.data().text,
              isCompleted: d.data().isCompleted,
              createdBy: d.data().createdBy,
              createdAt: d.data().createdAt,
            }) as Task,
        ),
      ),
    );

    const chatQuery = query(
      collection(db, "rooms", roomId, "chat"),
      orderBy("createdAt", "asc"),
    );

    const unsubChat = onSnapshot(chatQuery, (s) =>
      setMessages(
        s.docs.map(
          (d) =>
            ({
              id: d.id,
              text: d.data().text,
              sender: d.data().sender,
              createdAt: d.data().createdAt,
            }) as ChatMessage,
        ),
      ),
    );

    return () => {
      unsubMembers();
      unsubTasks();
      unsubChat();
    };
  }, [roomId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)
      .toString()
      .padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 text-slate-700">
        Updating UI Components...
      </div>
    );

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 text-slate-700 p-6 flex flex-col">
      {/* TOP BAR */}
      <div className="flex w-full gap-6 mb-6 items-start">
        {/* MEMBERS LIST */}
        <div className="w-[400px] h-[290px] flex flex-col bg-white/60 backdrop-blur rounded-xl shadow-xl p-4 max-h-[300px] overflow-y-auto">
          <span className="text-xs text-slate-600 uppercase tracking-widest mb-2">
            Members
          </span>
          <ul className="space-y-2">
            {members.map((m) => (
              <li
                key={m.id}
                className="text-sm font-medium text-slate-800 flex justify-between items-center"
              >
                <span>{m.email?.split("@")[0]}</span>
                {m.id === user?.uid && (
                  <span className="text-xs text-indigo-500">(You)</span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* TIMER */}
        <div className="flex-1 max-w-[700px] h-[290px] flex flex-col items-center justify-center bg-white/50 backdrop-blur rounded-xl p-6 shadow-xl">
          <div className="text-xs uppercase tracking-widest text-slate-600 mb-2">
            {mode}
          </div>

          <div className="text-6xl font-mono font-bold text-slate-700 mb-5">
            {formatTime(timeLeft)}
          </div>

          {!isRunning && (
            <div className="flex gap-6 mb-5">
              <div className="flex flex-col items-center">
                <span className="text-xs text-slate-600 mb-1">Focus</span>
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
                  className="w-16 text-center bg-white/70 rounded p-2 outline-none"
                />
              </div>

              <div className="flex flex-col items-center">
                <span className="text-xs text-slate-600 mb-1">Break</span>
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
                  className="w-16 text-center bg-white/70 rounded p-2 outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex gap-4 items-center">
            <button
              onClick={() => (isRunning ? pauseTimer() : startTimer())}
              className="w-14 h-14 rounded-full bg-indigo-300 hover:bg-indigo-400 text-white text-xl flex items-center justify-center hover:scale-105 transition"
            >
              {isRunning ? "❚❚" : "▶"}
            </button>

            <button
              onClick={() => resetTimer()}
              className="w-10 h-10 rounded-full bg-white/70 text-slate-700 text-lg flex items-center justify-center"
            >
              ⟳
            </button>

            <button
              onClick={() => switchMode()}
              className="px-5 py-2 rounded-full bg-indigo-300 hover:bg-indigo-400 text-white font-semibold"
            >
              {mode === "Focus" ? "Break" : "Focus"}
            </button>
          </div>
        </div>

        {/* ROOM CODE */}
        <div className="w-[350px] flex flex-col justify-center bg-white/60 backdrop-blur rounded-xl shadow-xl p-4">
          <span className="text-xs text-slate-600 uppercase tracking-widest mb-2">
            Room Code
          </span>
          <div className="flex items-center justify-between bg-white/80 border border-white/50 rounded-lg px-3 py-2 shadow">
            <span className="font-mono text-base font-bold text-slate-800 tracking-widest truncate">
              {roomId}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(roomId || "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1000);
              }}
              className="ml-2 px-2 py-1 text-xs font-semibold bg-purple-300 text-white rounded hover:bg-purple-400 transition"
            >
              {copied ? "✓" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex flex-1 gap-6">
        {/* CHAT SIDEBAR */}
        <div className="w-[400px] h-[520px] bg-white/60 backdrop-blur rounded-xl shadow-xl flex flex-col">
          <div className="bg-indigo-100 text-slate font-bold p-4 rounded-t-xl">
            Room Chat
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
            {messages.map((m) => {
              const isMe = m.sender === user?.email;

              return (
                <div
                  key={m.id}
                  className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`px-4 py-2 rounded-lg text-sm max-w-xs ${
                      isMe
                        ? "bg-indigo-300 text-white"
                        : "bg-white text-slate-700"
                    }`}
                  >
                    {!isMe && (
                      <div className="text-[10px] opacity-60 mb-1">
                        {m.sender?.split("@")[0]}
                      </div>
                    )}

                    {m.text}
                  </div>
                </div>
              );
            })}

            <div ref={chatBottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();

              if (!chatInput.trim()) return;

              addDoc(collection(db, "rooms", roomId!, "chat"), {
                text: chatInput,
                sender: user?.email,
                createdAt: serverTimestamp(),
              });

              setChatInput("");
            }}
            className="p-4 flex gap-2 border-t border-white/40"
          >
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Send message..."
              className="flex-1 bg-white/70 text-sm p-2.5 rounded-lg outline-none"
            />

            <button className="bg-indigo-300 hover:bg-indigo-400 px-5 rounded-lg text-white font-bold">
              Send
            </button>
          </form>
        </div>

        {/* TASK BOARDS */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 overflow-y-auto pr-2">
          {members.map((member) => {
            const isMe = member.id === user?.uid;

            const memberTasks = tasks.filter(
              (t) => t.createdBy === member.email,
            );

            const progress =
              memberTasks.length === 0
                ? 0
                : Math.round(
                    (memberTasks.filter((t) => t.isCompleted).length /
                      memberTasks.length) *
                      100,
                  );

            return (
              <div
                key={member.id}
                className="bg-white/60 backdrop-blur rounded-xl shadow-xl flex flex-col h-[320px]"
              >
                <div className="bg-indigo-300 hover:bg-indigo-400 p-4 flex justify-between items-center">
                  <h3 className="text-xs font-bold text-white truncate max-w-[120px]">
                    {member.email?.split("@")[0]} {isMe && "(You)"}
                  </h3>

                  <div className="relative w-24 h-4 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white"
                      style={{ width: `${progress}%` }}
                    />

                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-700">
                      {progress}%
                    </span>
                  </div>
                </div>

                <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                  <ul className="space-y-3">
                    {memberTasks.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-start gap-3 group min-h-[28px]"
                      >
                        <input
                          type="checkbox"
                          checked={t.isCompleted}
                          disabled={!isMe}
                          onChange={() =>
                            updateDoc(
                              doc(db, "rooms", roomId!, "tasks", t.id),
                              {
                                isCompleted: !t.isCompleted,
                              },
                            )
                          }
                          className="mt-1 accent-purple-400 w-4 h-4 cursor-pointer shrink-0"
                        />

                        <span
                          className={`text-base leading-tight flex-1 ${
                            t.isCompleted
                              ? "line-through text-slate-400"
                              : "text-slate-700"
                          }`}
                        >
                          {t.text}
                        </span>

                        {isMe && (
                          <button
                            onClick={() =>
                              deleteDoc(
                                doc(db, "rooms", roomId!, "tasks", t.id),
                              )
                            }
                            className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-500 font-bold"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {isMe && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();

                      if (newTaskInput.trim()) {
                        addDoc(collection(db, "rooms", roomId!, "tasks"), {
                          text: newTaskInput,
                          isCompleted: false,
                          createdBy: user.email,
                          createdAt: Date.now(),
                        });

                        setNewTaskInput("");
                      }
                    }}
                    className="p-4 flex gap-2"
                  >
                    <input
                      type="text"
                      value={newTaskInput}
                      onChange={(e) => setNewTaskInput(e.target.value)}
                      placeholder="Add task..."
                      className="flex-1 bg-white/70 text-xs p-2.5 rounded-lg outline-none"
                    />

                    <button className="bg-indigo-300 hover:bg-indigo-400 px-4 rounded text-white font-bold">
                      +
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5f5; border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a5b4fc; }
    `}</style>
    </div>
  );
}
