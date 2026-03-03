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
  updateDoc 
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useauth";
import { useTimer } from "../hooks/useTimer";

interface Member { id: string; email: string; }
interface Task { id: string; text: string; isCompleted: boolean; createdBy: string; createdAt: string; }

export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // CHECKPOINT TIMER 1: Logic strictly preserved
  const { timeLeft, isRunning, mode, durations, startTimer, pauseTimer, updateSettings } = useTimer(roomId);

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");

  const [fInput, setFInput] = useState("25");
  const [bInput, setBInput] = useState("5");

  useEffect(() => {
    setFInput(Math.floor(durations.focus / 60).toString());
    setBInput(Math.floor(durations.break / 60).toString());
  }, [durations]);

  const handleStep = (type: 'focus' | 'break', delta: number) => {
    if (type === 'focus') {
      const newVal = Math.max(1, (parseInt(fInput) || 0) + delta);
      setFInput(newVal.toString());
      updateSettings(newVal, parseInt(bInput) || 5);
    } else {
      const newVal = Math.max(1, (parseInt(bInput) || 0) + delta);
      setBInput(newVal.toString());
      updateSettings(parseInt(fInput) || 25, newVal);
    }
  };

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
    const unsubTasks = onSnapshot(collection(db, "rooms", roomId, "tasks"), (s) => 
      setTasks(s.docs.map(d => ({ id: d.id, ...d.data() } as Task)))
    );
    return () => { unsubMembers(); unsubTasks(); };
  }, [roomId]);

  const formatTime = (s: number) => 
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  if (loading) return <div className="min-h-screen bg-stone-950 flex items-center justify-center text-stone-500 font-mono text-xs tracking-widest uppercase italic">Establishing Connection...</div>;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 p-8">
      
      {/* ⏱ TIMER SECTION (CHECKPOINT 1) */}
      <div className="flex flex-col items-center justify-center bg-stone-900 border border-stone-800 rounded-xl p-8 mb-12 shadow-2xl max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-xl">{mode === "Focus" ? "💻" : "☕"}</span>
          <div className="text-stone-400 text-sm font-medium uppercase tracking-widest">{mode} Session</div>
        </div>
        <div className="text-8xl font-mono font-bold text-white mb-8 tracking-tighter">{formatTime(timeLeft)}</div>
        {!isRunning && (
          <div className="flex gap-10 mb-8 p-6 bg-stone-800/30 rounded-2xl border border-stone-800">
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-stone-500 uppercase font-bold">Focus</span>
              <div className="flex items-center gap-3 bg-stone-900 rounded-lg p-1 border border-stone-700">
                <button onClick={() => handleStep('focus', -1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-stone-800 text-[#556b2f] font-bold text-lg">–</button>
                <input type="text" value={fInput} onChange={(e) => setFInput(e.target.value)} className="w-10 bg-transparent text-center font-mono font-bold text-lg outline-none" placeholder="25" />
                <button onClick={() => handleStep('focus', 1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-stone-800 text-[#556b2f] font-bold text-lg">+</button>
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-stone-500 uppercase font-bold">Break</span>
              <div className="flex items-center gap-3 bg-stone-900 rounded-lg p-1 border border-stone-700">
                <button onClick={() => handleStep('break', -1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-stone-800 text-[#556b2f] font-bold text-lg">–</button>
                <input type="text" value={bInput} onChange={(e) => setBInput(e.target.value)} className="w-10 bg-transparent text-center font-mono font-bold text-lg outline-none" placeholder="5" />
                <button onClick={() => handleStep('break', 1)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-stone-800 text-[#556b2f] font-bold text-lg">+</button>
              </div>
            </div>
          </div>
        )}
        <div className="flex gap-4">
          {!isRunning ? (
            <button onClick={() => { const finalF = fInput === "" || fInput === "0" ? 25 : parseInt(fInput); const finalB = bInput === "" || bInput === "0" ? 5 : parseInt(bInput); setFInput(finalF.toString()); setBInput(finalB.toString()); updateSettings(finalF, finalB); const dur = mode === "Focus" ? finalF : finalB; startTimer(dur * 60, mode); }} className="bg-[#556b2f] hover:opacity-90 text-white px-12 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95">Start</button>
          ) : (
            <button onClick={() => pauseTimer(timeLeft)} className="bg-stone-700 hover:bg-stone-600 text-white px-12 py-3 rounded-full font-bold shadow-lg transition-all active:scale-95">Pause</button>
          )}
          <button onClick={() => { const nMode = mode === "Focus" ? "Short Break" : "Focus"; const finalF = fInput === "" || fInput === "0" ? 25 : parseInt(fInput); const finalB = bInput === "" || bInput === "0" ? 5 : parseInt(bInput); setFInput(finalF.toString()); setBInput(finalB.toString()); updateSettings(finalF, finalB); const nDur = nMode === "Focus" ? finalF : finalB; startTimer(nDur * 60, nMode); }} className="bg-stone-800 hover:bg-stone-700 text-stone-300 px-6 py-3 rounded-full font-bold transition-all">{mode === "Focus" ? "Break" : "Focus"}</button>
        </div>
      </div>

      {/* 🧑‍🤝‍🧑 UNIFORM MEMBER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {members.map((member) => {
          const isMe = member.email === user?.email;
          const memberTasks = tasks.filter(t => t.createdBy === member.email);
          const progress = memberTasks.length === 0 ? 0 : Math.round((memberTasks.filter(t => t.isCompleted).length / memberTasks.length) * 100);

          return (
            <div key={member.id} className="bg-stone-900 rounded-xl border border-stone-800 overflow-hidden shadow-xl flex flex-col h-[420px]"> {/* Standard height */}
              <div className="bg-[#556b2f] p-4 flex justify-between items-center shrink-0">
                <h3 className="text-xs font-bold text-white truncate max-w-[120px]">{member.email?.split('@')[0]} {isMe && "(You)"}</h3>
                <div className="relative w-24 h-5 border border-white/40 rounded-full flex items-center px-1 overflow-hidden">
                   <div className="absolute left-0 top-0 h-full bg-white/20 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
                   <span className="relative z-10 w-full text-center text-[9px] font-bold text-white">{progress}%</span>
                </div>
              </div>

              {/* UNIFORM LINE SPACING AREA */}
              <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-stone-900/20">
                <ul className="space-y-2"> {/* Identical vertical rhythm for everyone */}
                  {memberTasks.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-stone-700 text-[10px] font-bold uppercase tracking-[0.2em] py-20 opacity-50">Empty</div>
                  ) : (
                    memberTasks.map((t) => (
                      <li key={t.id} className="flex items-start gap-3 group min-h-[28px]"> {/* Fixed min-height for uniform rows */}
                        <div 
                          className={`mt-1.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isMe ? 'cursor-pointer' : 'opacity-40 pointer-events-none'} ${t.isCompleted ? 'bg-[#556b2f] border-[#556b2f]' : 'border-stone-600'}`}
                          onClick={() => { if (isMe) updateDoc(doc(db, "rooms", roomId!, "tasks", t.id), { isCompleted: !t.isCompleted }); }}
                        >
                          {t.isCompleted && <span className="text-white text-[10px] font-bold">✓</span>}
                        </div>
                        {/* UNIFORM 16px FONT */}
                        <span className={`text-base flex-1 leading-tight break-words pt-0.5 ${t.isCompleted ? 'line-through text-stone-600' : 'text-stone-300'}`}>
                          {t.text}
                        </span>
                        {isMe && <button onClick={() => deleteDoc(doc(db, "rooms", roomId!, "tasks", t.id))} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5">✕</button>}
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {/* UNIFORM FOOTER */}
              <div className="p-4 border-t border-stone-800 bg-stone-900 shrink-0">
                {isMe ? (
                  <form onSubmit={(e) => { e.preventDefault(); if (newTaskInput.trim()) { addDoc(collection(db, "rooms", roomId!, "tasks"), { text: newTaskInput, isCompleted: false, createdBy: user.email, createdAt: new Date().toISOString() }); setNewTaskInput(""); } }} className="flex gap-2">
                    <input type="text" value={newTaskInput} onChange={(e) => setNewTaskInput(e.target.value)} placeholder="Add task..." className="flex-1 bg-stone-800 text-xs p-2.5 rounded-lg outline-none border border-stone-700 focus:border-[#556b2f] transition-all" />
                    <button type="submit" className="bg-stone-700 px-3 rounded-lg text-lg">+</button>
                  </form>
                ) : (
                  <div className="h-[38px] flex items-center justify-center text-[10px] text-stone-700 font-bold uppercase tracking-widest border border-dashed border-stone-800 rounded-lg">
                    Peer Progress
                  </div>
                )}
              </div>
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