import { useEffect, useState, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
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
  const [cycleCount, setCycleCount] = useState(0);

  const [durations, setDurations] = useState<Durations>({
    focus: 1500,
    break: 300,
    longBreak: 900,
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playSound = () => {
    const audio = new Audio("/notification.mp3");
    audio.play().catch(() => {});
  };

  const handleAutoSwitch = () => {
    playSound();

    if (mode === "Focus") {
      const newCycle = cycleCount + 1;
      setCycleCount(newCycle);

      if (newCycle % 4 === 0) {
        setMode("Long Break");
        setTimeLeft(durations.longBreak);
      } else {
        setMode("Break");
        setTimeLeft(durations.break);
      }
    } else {
      setMode("Focus");
      setTimeLeft(durations.focus);
    }
  };

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAutoSwitch();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, cycleCount, durations]);

  useEffect(() => {
    if (!roomId) return;

    const load = async () => {
      const snap = await getDoc(doc(db, "rooms", roomId, "meta", "timer"));
      if (snap.exists()) {
        const data = snap.data();
        setMode(data.mode);
        setTimeLeft(data.timeLeft);
        setIsRunning(data.isRunning);
        setCycleCount(data.cycleCount || 0);
        setDurations(data.durations);
      }
    };

    load();
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    setDoc(doc(db, "rooms", roomId, "meta", "timer"), {
      mode,
      timeLeft,
      isRunning,
      cycleCount,
      durations,
    });
  }, [mode, timeLeft, isRunning, cycleCount, durations, roomId]);

  const startTimer = () => setIsRunning(true);
  const pauseTimer = () => setIsRunning(false);

  const resetTimer = () => {
    setIsRunning(false);
    setTimeLeft(
      mode === "Focus"
        ? durations.focus
        : mode === "Break"
        ? durations.break
        : durations.longBreak
    );
  };

  const switchMode = () => {
    setIsRunning(false);

    if (mode === "Focus") {
      setMode("Break");
      setTimeLeft(durations.break);
    } else {
      setMode("Focus");
      setTimeLeft(durations.focus);
    }
  };

  const updateSettings = (focusMin: number, breakMin: number) => {
    const newDurations = {
      focus: focusMin * 60,
      break: breakMin * 60,
      longBreak: 15 * 60,
    };

    setDurations(newDurations);

    if (!isRunning) {
      setTimeLeft(
        mode === "Focus"
          ? newDurations.focus
          : mode === "Break"
          ? newDurations.break
          : newDurations.longBreak
      );
    }
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