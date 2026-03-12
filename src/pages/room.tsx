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
  status?: string;
  nickname?: string;
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
  replyTo?: string | null;
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
  
  const [roomName, setRoomName] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);

  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);

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

  // --- 1. CORE FUNCTIONS ---

  const saveRoomToDashboard = async () => {
    if (!user || !roomId) return;
    try {
      await setDoc(doc(db, "rooms", roomId, "members", user.uid), {
        email: user.email,
        joinedAt: new Date(),
        status: !isRunning ? "Paused" : mode,
        nickname: user.email?.split("@")[0],
      });
    } catch (error) {
      console.error("Error saving room:", error);
    }
  };

  const handleUpdateTask = async (id: string) => {
    if (!editingText.trim() || !roomId) {
      setEditingTaskId(null);
      return;
    }
    try {
      await updateDoc(doc(db, "rooms", roomId, "tasks", id), { text: editingText.trim() });
      setEditingTaskId(null);
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // --- 2. EFFECTS ---

  useEffect(() => {
    async function checkRoom() {
      if (!roomId) return;
      const roomSnap = await getDoc(doc(db, "rooms", roomId));
      if (!roomSnap.exists()) {
        navigate("/dashboard");
        return;
      }
      const data = roomSnap.data();
      setRoomName(data.name || "Untitled Room");
      setOwnerId(data.createdBy || "");

      const timerRef = doc(db, "rooms", roomId, "meta", "timer");
      const timerSnap = await getDoc(timerRef);
      if (!timerSnap.exists()) {
        await setDoc(timerRef, {
          mode: "Focus",
          timeLeft: 1500,
          isRunning: false,
          durations: { focus: 1500, break: 300, longBreak: 900 },
          endsAt: null
        });
      }
      setLoading(false);
    }
    checkRoom();
  }, [roomId, navigate]);

  useEffect(() => {
    setFInput(Math.floor(durations.focus / 60).toString());
    setBInput(Math.floor(durations.break / 60).toString());
  }, [durations]);

  // Sync Saved Status
  useEffect(() => {
    if (!roomId || !user) return;
    const unsubSaved = onSnapshot(doc(db, "rooms", roomId, "members", user.uid), (snap) => {
      setIsSaved(snap.exists());
    });
    return () => unsubSaved();
  }, [roomId, user]);

  // THE RE-JOIN FIX: If you are in the room, ensure you are saved as a member
  useEffect(() => {
    if (!loading && user && roomId) {
      saveRoomToDashboard();
    }
  }, [loading, user, roomId]);

  useEffect(() => {
    if (!user || tasks.length === 0) return;
    const myTasks = tasks.filter((t) => t.createdBy === user.email);
    const completed = myTasks.filter((t) => t.isCompleted).length;
    const currentProgress = myTasks.length === 0 ? 0 : (completed / myTasks.length) * 100;

    if (currentProgress >= 99.9 && prevProgressRef.current < 99.9) {
      confetti({
        particleCount: 200,
        spread: 160,
        origin: { y: 0.6 },
        colors: ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF"],
      });
    }
    prevProgressRef.current = currentProgress;
  }, [tasks, user]);

  useEffect(() => {
    if (!user || !roomId || !isSaved) return;
    const memberRef = doc(db, "rooms", roomId, "members", user.uid);
    const status = !isRunning ? "Paused" : mode;
    updateDoc(memberRef, { status }).catch(() => {});
  }, [mode, isRunning, user, roomId, isSaved]);

  useEffect(() => {
    if (!roomId) return;
    const unsubRoom = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      if (snap.exists()) setRoomName(snap.data().name || "Untitled Room");
    });
    const unsubMembers = onSnapshot(collection(db, "rooms", roomId, "members"), (s) =>
      setMembers(s.docs.map((d) => ({
        id: d.id,
        email: d.data().email,
        status: d.data().status || "Offline",
        nickname: d.data().nickname || d.data().email?.split("@")[0],
      }) as Member))
    );
    const tasksQuery = query(collection(db, "rooms", roomId, "tasks"), orderBy("createdAt", "desc"));
    const unsubTasks = onSnapshot(tasksQuery, (s) =>
      setTasks(s.docs.map((d) => ({
        id: d.id,
        text: d.data().text,
        isCompleted: d.data().isCompleted,
        createdBy: d.data().createdBy,
        createdAt: d.data().createdAt,
      }) as Task))
    );
    const chatQuery = query(collection(db, "rooms", roomId, "chat"), orderBy("createdAt", "asc"));
    const unsubChat = onSnapshot(chatQuery, (s) =>
      setMessages(s.docs.map((d) => ({
        id: d.id,
        text: d.data().text,
        sender: d.data().sender,
        createdAt: d.data().createdAt,
        replyTo: d.data().replyTo || null,
      }) as ChatMessage))
    );
    return () => { unsubRoom(); unsubMembers(); unsubTasks(); unsubChat(); };
  }, [roomId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 text-slate-700 font-bold">Connecting...</div>;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-pink-200 via-purple-200 to-blue-200 text-slate-700 p-6 flex flex-col">
      
      <div className="flex justify-between items-center mb-6">
        <button 
          onClick={() => navigate('/dashboard')} 
          className="flex items-center gap-2 px-4 py-2 bg-white/40 hover:bg-white/60 rounded-lg text-sm font-bold transition shadow-sm border border-white/20"
        >
          ← Dashboard
        </button>

        {!isSaved ? (
          <span className="px-4 py-2 bg-indigo-100 text-indigo-600 rounded-lg text-sm font-bold animate-pulse">
            ⚡ Syncing Room...
          </span>
        ) : (
          <span className="px-4 py-2 bg-green-100/50 text-green-700 rounded-lg text-sm font-bold border border-green-200">
            ✓ Saved in History
          </span>
        )}
      </div>

      <div className="flex w-full gap-6 mb-6 items-start">
        {/* MEMBERS LIST */}
        <div className="w-[400px] h-[290px] flex flex-col bg-white/60 backdrop-blur rounded-xl shadow-xl p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
          <span className="text-xs text-slate-600 uppercase tracking-widest mb-2 font-bold">Members</span>
          <ul className="space-y-2">
            {members.map((m) => {
              const isMe = m.id === user?.uid;
              const status = m.status || "Offline";
              return (
                <li key={m.id} className="text-sm font-medium text-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      disabled={!isMe}
                      value={m.nickname}
                      onChange={(e) => {
                        const val = e.target.value;
                        setMembers((p) => p.map((x) => (x.id === m.id ? { ...x, nickname: val } : x)));
                        updateDoc(doc(db, "rooms", roomId!, "members", m.id), { nickname: val }).catch(() => {});
                      }}
                      className={`text-sm font-medium text-slate-800 bg-white/30 rounded px-1 py-0.5 w-[120px] ${!isMe ? 'border-none bg-transparent outline-none cursor-default' : ''}`}
                    />
                    <span>{status === "Focus" ? "📖 Focus" : status === "Break" ? "☕ Break" : status === "Paused" ? "⏸️ Paused" : "❌ Offline"}</span>
                  </div>
                  {isMe && <span className="text-xs text-indigo-500 font-bold">(You)</span>}
                </li>
              );
            })}
          </ul>
        </div>

        {/* TIMER */}
        <div className="flex-1 max-w-[700px] h-[290px] flex flex-col items-center justify-center bg-white/50 backdrop-blur rounded-xl p-6 shadow-xl">
          <div className="text-xs uppercase tracking-widest text-slate-600 mb-2 font-bold">{mode}</div>
          <div className="text-6xl font-mono font-bold text-slate-700 mb-5">{formatTime(timeLeft)}</div>

          {!isRunning && (
            <div className="flex gap-6 mb-5">
              <div className="flex flex-col items-center">
                <span className="text-xs text-slate-600 mb-1 font-bold">Focus</span>
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
                  className="w-16 text-center bg-white/70 rounded p-2 outline-none font-bold shadow-sm"
                />
              </div>
              <div className="flex flex-col items-center">
                <span className="text-xs text-slate-600 mb-1 font-bold">Break</span>
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
                  className="w-16 text-center bg-white/70 rounded p-2 outline-none font-bold shadow-sm"
                />
              </div>
            </div>
          )}

          <div className="flex gap-4 items-center">
            <button
              onClick={() => (isRunning ? pauseTimer() : startTimer())}
              className="w-14 h-14 rounded-full bg-indigo-300 hover:bg-indigo-400 text-white text-xl flex items-center justify-center hover:scale-105 transition shadow-md"
            >
              {isRunning ? "❚❚" : "▶"}
            </button>
            <button onClick={() => resetTimer()} className="w-10 h-10 rounded-full bg-white/70 text-slate-700 text-lg flex items-center justify-center shadow-sm">⟳</button>
            <button onClick={() => switchMode()} className="px-5 py-2 rounded-full bg-indigo-300 hover:bg-indigo-400 text-white font-bold shadow-md">{mode === "Focus" ? "Break" : "Focus"}</button>
          </div>
        </div>

        {/* ROOM DETAILS */}
        <div className="w-[350px] flex flex-col gap-4">
            <div className="flex flex-col justify-center bg-white/60 backdrop-blur rounded-xl shadow-xl p-4">
                <span className="text-xs text-slate-600 uppercase tracking-widest mb-2 font-bold">Room Name</span>
                <input
                    type="text"
                    value={roomName}
                    disabled={user?.uid !== ownerId}
                    onChange={(e) => setRoomName(e.target.value)}
                    onBlur={(e) => {
                        if (user?.uid === ownerId) {
                            updateDoc(doc(db, "rooms", roomId!), { name: e.target.value });
                        }
                    }}
                    placeholder="Enter room name..."
                    className={`bg-white/80 border border-white/50 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-purple-300 ${user?.uid !== ownerId ? 'cursor-default border-none' : ''}`}
                />
            </div>

            <div className="flex flex-col justify-center bg-white/60 backdrop-blur rounded-xl shadow-xl p-4">
            <span className="text-xs text-slate-600 uppercase tracking-widest mb-2 font-bold">Room Code</span>
            <div className="flex items-center justify-between bg-white/80 border border-white/50 rounded-lg px-3 py-2 shadow">
                <span className="font-mono text-base font-bold text-slate-800 tracking-widest truncate">{roomId}</span>
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
      </div>

      <div className="flex flex-1 gap-6">
        {/* CHAT */}
        <div className="w-[400px] h-[520px] bg-white/60 backdrop-blur rounded-xl shadow-xl flex flex-col">
          <div className="bg-indigo-100 text-slate-700 font-bold p-4 rounded-t-xl">Room Chat</div>
          <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
            {messages.map((m) => {
              const isMe = m.sender === user?.email;
              const repliedMessage = m.replyTo ? messages.find((msg) => msg.id === m.replyTo) : null;
              return (
                <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"} group`} onDoubleClick={() => { setReplyingTo(m); chatInputRef.current?.focus(); }}>
                  <div className="flex flex-col gap-1 relative max-w-xs">
                    {repliedMessage && <div className="px-2 py-1 text-[10px] bg-white/50 border-l-2 border-indigo-300 rounded-l-md text-slate-600">{repliedMessage.text}</div>}
                    <div className={`px-4 py-2 rounded-lg text-sm shadow-sm ${isMe ? "bg-indigo-300 text-white" : "bg-white text-slate-700"}`}>
                      {m.text}
                      <button onClick={() => { setReplyingTo(m); chatInputRef.current?.focus(); }} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-4 w-4 text-indigo-400"><path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!chatInput.trim()) return;
            addDoc(collection(db, "rooms", roomId!, "chat"), { text: chatInput, sender: user?.email, createdAt: serverTimestamp(), replyTo: replyingTo?.id || null });
            setChatInput("");
            setReplyingTo(null);
          }} className="p-4 flex gap-2 flex-col border-t border-white/40">
            {replyingTo && <div className="text-[10px] mb-1 px-2 py-1 bg-indigo-50 rounded flex justify-between items-center text-indigo-600 font-bold">{replyingTo.text}<button type="button" className="text-red-400 ml-2" onClick={() => setReplyingTo(null)}>✕</button></div>}
            <div className="flex gap-2">
              <input ref={chatInputRef} value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type message..." className="flex-1 bg-white/70 text-sm p-2.5 rounded-lg outline-none" />
              <button className="bg-indigo-300 hover:bg-indigo-400 px-5 rounded-lg text-white font-bold transition">Send</button>
            </div>
          </form>
        </div>

        {/* TASK BOARDS */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 overflow-y-auto pr-2 custom-scrollbar">
          {members.map((member) => {
            const isMe = member.id === user?.uid;
            const memberTasks = tasks.filter((t) => t.createdBy === member.email);
            const progress = memberTasks.length === 0 ? 0 : Math.round((memberTasks.filter((t) => t.isCompleted).length / memberTasks.length) * 100);
            return (
              <div key={member.id} className="bg-white/60 backdrop-blur rounded-xl shadow-xl flex flex-col h-[320px]">
                <div className="bg-indigo-300 p-4 flex justify-between items-center rounded-t-xl">
                  <h3 className="text-xs font-bold text-white truncate max-w-[120px]">{member.nickname} {isMe && "(You)"}</h3>
                  <div className="relative w-24 h-4 bg-white/30 rounded-full overflow-hidden">
                    <div className="h-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-700">{progress}%</span>
                  </div>
                </div>
                <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                  <ul className="space-y-3">
                    {memberTasks.map((t) => (
                      <li key={t.id} className="flex items-start gap-3 group min-h-[28px]">
                        <input
                          type="checkbox"
                          checked={t.isCompleted}
                          disabled={!isMe}
                          onChange={() => updateDoc(doc(db, "rooms", roomId!, "tasks", t.id), { isCompleted: !t.isCompleted })}
                          className="mt-1 accent-purple-400 w-4 h-4 cursor-pointer shrink-0"
                        />
                        {editingTaskId === t.id ? (
                          <input
                            autoFocus
                            className="flex-1 bg-white/80 text-sm border-b border-indigo-300 outline-none"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            onBlur={() => handleUpdateTask(t.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleUpdateTask(t.id); if (e.key === "Escape") setEditingTaskId(null); }}
                          />
                        ) : (
                          <span
                            className={`text-base leading-tight flex-1 ${t.isCompleted ? "line-through text-slate-400" : "text-slate-700"} ${isMe ? "cursor-pointer" : ""}`}
                            onDoubleClick={() => { if (isMe) { setEditingTaskId(t.id); setEditingText(t.text); } }}
                          >
                            {t.text}
                          </span>
                        )}
                        {isMe && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {editingTaskId !== t.id && <button onClick={() => { setEditingTaskId(t.id); setEditingText(t.text); }} className="text-indigo-400 hover:text-indigo-600 text-xs p-0.5 font-bold">✎</button>}
                            <button onClick={() => deleteDoc(doc(db, "rooms", roomId!, "tasks", t.id))} className="text-red-400 p-0.5 hover:text-red-500 font-bold">✕</button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                {isMe && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    if (newTaskInput.trim()) {
                      addDoc(collection(db, "rooms", roomId!, "tasks"), { text: newTaskInput, isCompleted: false, createdBy: user.email, createdAt: Date.now() });
                      setNewTaskInput("");
                    }
                  }} className="p-4 flex gap-2 border-t border-white/10">
                    <input type="text" value={newTaskInput} onChange={(e) => setNewTaskInput(e.target.value)} placeholder="Add task..." className="flex-1 bg-white/70 text-xs p-2.5 rounded-lg outline-none" />
                    <button className="bg-indigo-300 hover:bg-indigo-400 px-4 rounded text-white font-bold transition shadow-sm">+</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-track { background: transparent; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5f5; border-radius: 10px; } .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #a5b4fc; }`}</style>
    </div>
  );
}