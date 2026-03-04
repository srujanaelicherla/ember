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
  orderBy
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

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");

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

  // 🎉 Confetti Logic
  useEffect(() => {
    if (!user || tasks.length === 0) return;
    const myTasks = tasks.filter(t => t.createdBy === user.email);
    const completed = myTasks.filter(t => t.isCompleted).length;
    const currentProgress = (completed / myTasks.length) * 100;

    if (currentProgress >= 99.9 && prevProgressRef.current < 99.9) {
      confetti({
        particleCount: 200,
        spread: 160,
        origin: { y: 0.6 },
        colors: ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']
      });
    }
    prevProgressRef.current = currentProgress;
  }, [tasks, user]);

  useEffect(() => {
    async function checkRoom() {
      if (!roomId) return;
      const snapshot = await getDoc(doc(db, "rooms", roomId));
      if (!snapshot.exists()) { navigate("/dashboard"); return; }
      setLoading(false);
    }
    checkRoom();
  }, [roomId, navigate]);

  useEffect(() => {
    if (!roomId || !user) return;
    const memberRef = doc(db, "rooms", roomId, "members", user.uid);
    setDoc(memberRef, { email: user.email, joinedAt: new Date() });
    return () => { deleteDoc(memberRef).catch(() => {}); };
  }, [roomId, user]);

  useEffect(() => {
    if (!roomId) return;
    const unsubMembers = onSnapshot(collection(db, "rooms", roomId, "members"), (s) => 
      setMembers(s.docs.map(d => ({ id: d.id, email: d.data().email } as Member)))
    );

    const tasksQuery = query(collection(db, "rooms", roomId, "tasks"), orderBy("createdAt", "desc"));
    const unsubTasks = onSnapshot(tasksQuery, (s) => 
      setTasks(s.docs.map(d => ({ 
        id: d.id, 
        text: d.data().text,
        isCompleted: d.data().isCompleted,
        createdBy: d.data().createdBy,
        createdAt: d.data().createdAt
      } as Task)))
    );

    return () => { unsubMembers(); unsubTasks(); };
  }, [roomId]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-500 font-mono text-xs tracking-widest uppercase italic">Updating UI Components...</div>;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 p-8">
      {/* TIMER SECTION (FINAL CHECKPOINT) */}
      <div className="flex flex-col items-center justify-center bg-stone-900 border border-stone-800 rounded-xl p-8 mb-12 shadow-2xl max-w-2xl mx-auto">
        <div className="text-sm uppercase tracking-widest text-stone-400 mb-2">{mode}</div>
        <div className="text-8xl font-mono font-bold text-white mb-8">{formatTime(timeLeft)}</div>
        {!isRunning && (
          <div className="flex gap-10 mb-8">
            <div className="flex flex-col items-center">
              <span className="text-xs text-stone-400 mb-2">Focus</span>
              <input type="number" min={1} value={fInput} onChange={(e) => setFInput(e.target.value)} onBlur={() => { const val = Math.max(1, parseInt(fInput) || 25); setFInput(val.toString()); updateSettings(val, parseInt(bInput) || 5); }} className="w-16 text-center bg-stone-800 rounded p-2 outline-none border border-stone-700" />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xs text-stone-400 mb-2">Break</span>
              <input type="number" min={1} value={bInput} onChange={(e) => setBInput(e.target.value)} onBlur={() => { const val = Math.max(1, parseInt(bInput) || 5); setBInput(val.toString()); updateSettings(parseInt(fInput) || 25, val); }} className="w-16 text-center bg-stone-800 rounded p-2 outline-none border border-stone-700" />
            </div>
          </div>
        )}
        <div className="flex gap-6 items-center">
          <button onClick={() => (isRunning ? pauseTimer() : startTimer())} className="w-16 h-16 rounded-full bg-[#556b2f] text-white text-2xl flex items-center justify-center hover:opacity-90 active:scale-95 transition-all">{isRunning ? "❚❚" : "▶"}</button>
          <button onClick={() => resetTimer()} className="w-12 h-12 rounded-full bg-stone-700 text-white text-xl flex items-center justify-center hover:bg-stone-600 transition-all">⟳</button>
          <button onClick={() => switchMode()} className="px-6 py-3 rounded-full bg-stone-700 text-white font-bold hover:bg-stone-600 transition-all">{mode === "Focus" ? "Break" : "Focus"}</button>
        </div>
      </div>

      {/* 👥 MEMBER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {members.map((member) => {
          const isMe = member.id === user?.uid;
          const memberTasks = tasks.filter((t) => t.createdBy === member.email);
          const progress = memberTasks.length === 0 ? 0 : Math.round((memberTasks.filter((t) => t.isCompleted).length / memberTasks.length) * 100);

          return (
            <div key={member.id} className="bg-stone-900 rounded-xl border border-stone-800 overflow-hidden shadow-xl flex flex-col h-[420px]">
              <div className="bg-[#556b2f] p-4 flex justify-between items-center shrink-0">
                <h3 className="text-xs font-bold text-white truncate max-w-[120px]">{member.email?.split("@")[0]} {isMe && "(You)"}</h3>
                <div className="relative w-24 h-4 bg-black/30 rounded-full overflow-hidden border border-white/10">
                  <div className="h-full bg-white transition-all duration-500" style={{ width: `${progress}%` }} />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-black mix-blend-difference">{progress}%</span>
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
                        className="mt-1 accent-[#556b2f] w-4 h-4 cursor-pointer shrink-0" 
                      />
                      <span className={`text-base leading-tight flex-1 ${t.isCompleted ? "line-through text-stone-600" : "text-stone-300"}`}>
                        {t.text}
                      </span>
                      {/* ❌ RED DELETE CROSS ON HOVER */}
                      {isMe && (
                        <button
                          onClick={() => deleteDoc(doc(db, "rooms", roomId!, "tasks", t.id))}
                          className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-red-400 font-bold"
                          title="Delete task"
                        >
                          ✕
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {isMe && (
                <form onSubmit={(e) => { e.preventDefault(); if (newTaskInput.trim()) { addDoc(collection(db, "rooms", roomId!, "tasks"), { text: newTaskInput, isCompleted: false, createdBy: user.email, createdAt: Date.now() }); setNewTaskInput(""); } }} className="p-4 border-t border-stone-800 flex gap-2">
                  <input type="text" value={newTaskInput} onChange={(e) => setNewTaskInput(e.target.value)} placeholder="Add task..." className="flex-1 bg-stone-800 text-xs p-2.5 rounded-lg outline-none border border-stone-700 focus:border-[#556b2f]" />
                  <button className="bg-stone-700 px-4 rounded text-white font-bold">+</button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #556b2f; }
      `}</style>
    </div>
  );
}