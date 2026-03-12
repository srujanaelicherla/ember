import { useEffect, useState, useRef } from "react";
import { doc, onSnapshot, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

type Mode = "Focus" | "Break" | "Long Break";

interface Durations {
  focus: number;
  break: number;
  longBreak: number;
}

export function useTimer(roomId?: string) {
  const [mode, setMode] = useState<Mode>("Focus");
  const [timeLeft, setTimeLeft] = useState(1500);
  const [isRunning, setIsRunning] = useState(false);
  const [durations, setDurations] = useState<Durations>({
    focus: 1500,
    break: 300,
    longBreak: 900,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!roomId) return;

    const timerDocRef = doc(db, "rooms", roomId, "meta", "timer");

    const unsub = onSnapshot(timerDocRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      setMode(data.mode);
      setDurations(data.durations);
      setIsRunning(data.isRunning);

      if (data.isRunning && data.endsAt) {
        const endMillis = (data.endsAt as Timestamp).toMillis();
        const updateTick = () => {
          const now = Date.now();
          const remaining = Math.max(0, Math.round((endMillis - now) / 1000));
          
          if (remaining <= 0) {
            setTimeLeft(0);
            if (timerRef.current) clearInterval(timerRef.current);
          } else {
            setTimeLeft(remaining);
          }
        };

        updateTick();
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(updateTick, 1000);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(data.timeLeft || 0);
      }
    });

    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomId]);

  const startTimer = async () => {
    if (!roomId) return;
    const endsAt = Date.now() + timeLeft * 1000;
    await updateDoc(doc(db, "rooms", roomId, "meta", "timer"), {
      isRunning: true,
      endsAt: Timestamp.fromMillis(endsAt),
    });
  };

  const pauseTimer = async () => {
    if (!roomId) return;
    await updateDoc(doc(db, "rooms", roomId, "meta", "timer"), {
      isRunning: false,
      timeLeft: timeLeft,
      endsAt: null,
    });
  };

  const resetTimer = async () => {
    if (!roomId) return;
    const defaultTime = mode === "Focus" ? durations.focus : mode === "Break" ? durations.break : durations.longBreak;
    await updateDoc(doc(db, "rooms", roomId, "meta", "timer"), {
      isRunning: false,
      timeLeft: defaultTime,
      endsAt: null,
    });
  };

  const switchMode = async () => {
    if (!roomId) return;
    const nextMode = mode === "Focus" ? "Break" : "Focus";
    const nextTime = nextMode === "Focus" ? durations.focus : durations.break;
    
    await updateDoc(doc(db, "rooms", roomId, "meta", "timer"), {
      mode: nextMode,
      isRunning: false,
      timeLeft: nextTime,
      endsAt: null,
    });
  };

  const updateSettings = async (focusMin: number, breakMin: number) => {
    if (!roomId) return;
    const newDurations = {
      focus: focusMin * 60,
      break: breakMin * 60,
      longBreak: 15 * 60,
    };

    const nextTime = mode === "Focus" ? newDurations.focus : mode === "Break" ? newDurations.break : newDurations.longBreak;

    await updateDoc(doc(db, "rooms", roomId, "meta", "timer"), {
      durations: newDurations,
      timeLeft: isRunning ? timeLeft : nextTime,
    });
  };

  return {
    mode,
    timeLeft,
    isRunning,
    durations,
    startTimer,
    pauseTimer,
    resetTimer,
    switchMode,
    updateSettings,
  };
}