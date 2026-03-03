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

interface Member {
  id: string;
  email: string;
}

interface TaskItem {
  id: string;
  text: string;
  isCompleted: boolean;
  createdBy: string;
}


export default function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [exists, setExists] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  
  // Task States
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [newTaskInput, setNewTaskInput] = useState("");

  // 1. Validate Room
  useEffect(() => {
    async function checkRoom() {
      if (!roomId) return;
      const roomRef = doc(db, "rooms", roomId);
      const snapshot = await getDoc(roomRef);
      if (snapshot.exists()) {
        setExists(true);
      } else {
        alert("Room does not exist");
        navigate("/dashboard");
      }
      setLoading(false);
    }
    checkRoom();
  }, [roomId, navigate]);

  // 2. Real-time Presence
  useEffect(() => {
    if (!roomId || !user) return;
    const memberRef = doc(db, "rooms", roomId, "members", user.uid);
    setDoc(memberRef, { email: user.email, joinedAt: new Date() });
    return () => { deleteDoc(memberRef); };
  }, [roomId, user]);

  // 3. Listen to Members
  useEffect(() => {
    if (!roomId) return;
    const membersRef = collection(db, "rooms", roomId, "members");
    const unsubscribe = onSnapshot(membersRef, (snapshot) => {
      setMembers(snapshot.docs.map((doc) => ({ id: doc.id, email: doc.data().email })));
    });
    return () => unsubscribe();
  }, [roomId]);

  // 4. Listen to Flat Tasks Collection
  useEffect(() => {
    if (!roomId) return;
    const tasksRef = collection(db, "rooms", roomId, "tasks");
    
    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const list: TaskItem[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        text: doc.data().text,
        isCompleted: doc.data().isCompleted,
        createdBy: doc.data().createdBy,
      }));
      setTasks(list);
    });

    return () => unsubscribe();
  }, [roomId]);

  // --- Task Functions ---
  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskInput.trim() || !roomId || !user || !user.email) return;

    await addDoc(collection(db, "rooms", roomId, "tasks"), {
      text: newTaskInput,
      isCompleted: false,
      createdBy: user.email,
      createdAt: new Date().toISOString(),
    });

    setNewTaskInput("");
  }

  async function toggleTask(task: TaskItem) {
    if (!roomId || !user) return;
    if (task.createdBy !== user.email) return; // Silent block if not the owner

    const taskRef = doc(db, "rooms", roomId, "tasks", task.id);
    await updateDoc(taskRef, { isCompleted: !task.isCompleted });
  }

  async function deleteTask(task: TaskItem) {
    if (!roomId || !user) return;
    if (task.createdBy !== user.email) return;

    const taskRef = doc(db, "rooms", roomId, "tasks", task.id);
    await deleteDoc(taskRef);
  }

  if (loading) return <div className="min-h-screen bg-stone-950 text-stone-200 flex items-center justify-center">Loading room...</div>;
  if (!exists) return null;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-200 p-8">
      
      {/* Top Navigation / Room Info */}
      <div className="flex justify-between items-center mb-8 border-b border-stone-800 pb-4">
        <h1 className="text-2xl font-bold text-stone-100 flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
          Room: {roomId}
        </h1>
        <div className="text-sm text-stone-400">
          {members.length} {members.length === 1 ? 'person' : 'people'} focusing
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 items-start">
        
        {/* Dynamic Member Cards (The Fiveable Grid) */}
        {members.map((member) => {
          const isMe = member.email === user?.email;
          const memberTasks = tasks.filter(t => t.createdBy === member.email);
          const completedCount = memberTasks.filter(t => t.isCompleted).length;
          const progress = memberTasks.length === 0 ? 0 : Math.round((completedCount / memberTasks.length) * 100);

          return (
            <div key={member.id} className="bg-stone-900 rounded-lg overflow-hidden shadow-lg border border-stone-800 flex flex-col h-fit">
              
              {/* Card Header - Earthy Olive Green */}
              <div className="bg-[#556b2f] p-3 flex justify-between items-center">
                <h3 className="font-bold text-white text-sm truncate pr-2">
                  {member.email.split('@')[0]} {isMe && "(You)"}
                </h3>
                <div className="flex items-center gap-2 text-xs font-medium text-white/90 shrink-0">
                  <span>{progress}%</span>
                  <div className="w-16 h-1.5 bg-stone-900/40 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white transition-all duration-500 ease-out" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex flex-col gap-4">
                {memberTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 opacity-50">
                    <span className="text-2xl mb-2">🌿</span>
                    <p className="text-xs">No tasks yet!</p>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {memberTasks.map((task) => (
                      <li key={task.id} className="flex items-start gap-2 group">
                        <div 
                          className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${isMe ? 'cursor-pointer hover:border-emerald-500' : 'cursor-default opacity-70'} ${task.isCompleted ? 'bg-emerald-600 border-emerald-600' : 'border-stone-500'}`}
                          onClick={() => toggleTask(task)}
                        >
                          {task.isCompleted && <span className="text-white text-[10px] font-bold">✓</span>}
                        </div>
                        <span className={`text-sm flex-1 break-words ${task.isCompleted ? 'line-through text-stone-500' : 'text-stone-300'}`}>
                          {task.text}
                        </span>
                        {isMe && (
                          <button 
                            onClick={() => deleteTask(task)} 
                            className="text-[10px] text-red-400 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                          >
                            ✕
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Input Field - Only visible on YOUR card */}
                {isMe && (
                  <form onSubmit={handleAddTask} className="mt-auto pt-2 flex gap-2">
                    <input
                      type="text"
                      value={newTaskInput}
                      onChange={(e) => setNewTaskInput(e.target.value)}
                      placeholder="Add Task"
                      className="flex-1 p-2 text-sm rounded bg-stone-800 text-stone-200 outline-none focus:ring-1 focus:ring-emerald-500 border border-stone-700"
                    />
                    <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 rounded text-sm font-bold transition-colors">
                      +
                    </button>
                  </form>
                )}
              </div>

            </div>
          );
        })}

      </div>
    </div>
  );
}