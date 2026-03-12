import { useEffect, useState, useRef } from "react";
import {
  doc,
  onSnapshot,
  updateDoc,
  setDoc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";

type Mode = "Focus" | "Break" | "Long Break";

interface Durations {
  focus: number;
  break: number;
  longBreak: number;
}

export function useTimer(roomId?: string, userId?: string) {
  const [mode, setMode] = useState<Mode>("Focus");
  const [timeLeft, setTimeLeft] = useState(1500);
  const [isRunning, setIsRunning] = useState(false);
  const [durations, setDurations] = useState<Durations>({
    focus: 1500,
    break: 300,
    longBreak: 900,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* -------------------------------- AUTO SWITCH -------------------------------- */

  const handleAutoSwitch = async (currentMode: Mode, d: Durations) => {
    if (!roomId || !userId) return;

    const nextMode = currentMode === "Focus" ? "Break" : "Focus";

    const nextTime =
      nextMode === "Focus"
        ? d.focus
        : nextMode === "Break"
        ? d.break
        : d.longBreak;

    await updateDoc(doc(db, "rooms", roomId, "timers", userId), {
      mode: nextMode,
      isRunning: true,
      timeLeft: nextTime,
      endsAt: Timestamp.fromMillis(Date.now() + nextTime * 1000),
    });
  };

  /* -------------------------------- LISTENER -------------------------------- */

  useEffect(() => {
    if (!roomId || !userId) return;

    const timerDocRef = doc(db, "rooms", roomId, "timers", userId);

    const ensureTimer = async () => {
      const snap = await getDoc(timerDocRef);

      if (!snap.exists()) {
        await setDoc(timerDocRef, {
          mode: "Focus",
          timeLeft: 1500,
          isRunning: false,
          durations: {
            focus: 1500,
            break: 300,
            longBreak: 900,
          },
          endsAt: null,
        });
      }
    };

    ensureTimer();

    const unsub = onSnapshot(timerDocRef, (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();

      setMode(data.mode);
      setDurations(data.durations);
      setIsRunning(data.isRunning);

      if (data.isRunning && data.endsAt) {
        const endMillis = (data.endsAt as Timestamp).toMillis();

        const tick = () => {
          const remaining = Math.max(
            0,
            Math.round((endMillis - Date.now()) / 1000)
          );

          if (remaining <= 0) {
            clearInterval(timerRef.current!);
            handleAutoSwitch(data.mode, data.durations);
          } else {
            setTimeLeft(remaining);
          }
        };

        tick();

        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(tick, 1000);
      } else {
        if (timerRef.current) clearInterval(timerRef.current);
        setTimeLeft(data.timeLeft || 0);
      }
    });

    return () => {
      unsub();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [roomId, userId]);

  /* -------------------------------- CONTROLS -------------------------------- */

  const startTimer = async () => {
    if (!roomId || !userId) return;

    const endsAt = Date.now() + timeLeft * 1000;

    await updateDoc(doc(db, "rooms", roomId, "timers", userId), {
      isRunning: true,
      endsAt: Timestamp.fromMillis(endsAt),
    });
  };

  const pauseTimer = async () => {
    if (!roomId || !userId) return;

    await updateDoc(doc(db, "rooms", roomId, "timers", userId), {
      isRunning: false,
      timeLeft,
      endsAt: null,
    });
  };

  const resetTimer = async () => {
    if (!roomId || !userId) return;

    const defaultTime =
      mode === "Focus"
        ? durations.focus
        : mode === "Break"
        ? durations.break
        : durations.longBreak;

    await updateDoc(doc(db, "rooms", roomId, "timers", userId), {
      isRunning: false,
      timeLeft: defaultTime,
      endsAt: null,
    });
  };

  const switchMode = async () => {
    if (!roomId || !userId) return;

    const nextMode = mode === "Focus" ? "Break" : "Focus";

    const nextTime =
      nextMode === "Focus" ? durations.focus : durations.break;

    await updateDoc(doc(db, "rooms", roomId, "timers", userId), {
      mode: nextMode,
      isRunning: false,
      timeLeft: nextTime,
      endsAt: null,
    });
  };

  const updateSettings = async (focusMin: number, breakMin: number) => {
    if (!roomId || !userId) return;

    const newDurations = {
      focus: focusMin * 60,
      break: breakMin * 60,
      longBreak: 15 * 60,
    };

    const nextTime =
      mode === "Focus"
        ? newDurations.focus
        : mode === "Break"
        ? newDurations.break
        : newDurations.longBreak;

    await updateDoc(doc(db, "rooms", roomId, "timers", userId), {
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