import { useState, useEffect, useCallback } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export function useTimer(roomId: string | undefined) {
  const [timeLeft, setTimeLeft] = useState(1500); 
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState("Focus");
  const [durations, setDurations] = useState({ focus: 1500, break: 300 });

  const handleAutoTransition = useCallback(async (currentMode: string, fDur: number, bDur: number) => {
    if (!roomId) return;
    const timerRef = doc(db, "rooms", roomId, "timer", "state");
    
    const nextMode = currentMode === "Focus" ? "Short Break" : "Focus";
    const nextDuration = nextMode === "Focus" ? fDur : bDur;

    // IMMEDIATE LOCAL UPDATE: Kills the lag
    setMode(nextMode);
    setTimeLeft(nextDuration);

    await setDoc(timerRef, {
      isRunning: true,
      startTime: serverTimestamp(),
      duration: nextDuration,
      mode: nextMode,
      focusDuration: fDur,
      breakDuration: bDur
    }, { merge: true });
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const timerRef = doc(db, "rooms", roomId, "timer", "state");

    const unsubscribe = onSnapshot(timerRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const serverTime = Date.now();
        const startTime = (data.startTime as Timestamp)?.toMillis() || serverTime;
        
        const currentMode = data.mode || "Focus";
        const fDur = data.focusDuration || 1500;
        const bDur = data.breakDuration || 300;
        const currentDuration = data.duration || (currentMode === "Focus" ? fDur : bDur);
        
        setMode(currentMode);
        setIsRunning(data.isRunning);
        setDurations({ focus: fDur, break: bDur });

        if (data.isRunning) {
          const elapsed = Math.floor((serverTime - startTime) / 1000);
          const remaining = Math.max(0, currentDuration - elapsed);
          setTimeLeft(remaining);

          // Atomic trigger for transition
          if (remaining <= 0) {
            handleAutoTransition(currentMode, fDur, bDur);
          }
        } else {
          setTimeLeft(currentDuration);
        }
      }
    });

    return () => unsubscribe();
  }, [roomId, handleAutoTransition]);

  useEffect(() => {
    let interval: number | undefined; 
    if (isRunning && timeLeft > 0) {
      interval = window.setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    }
    return () => window.clearInterval(interval);
  }, [isRunning, timeLeft]);

  const startTimer = async (duration: number, modeName: string) => {
    if (!roomId) return;
    const timerRef = doc(db, "rooms", roomId, "timer", "state");
    await setDoc(timerRef, {
      isRunning: true,
      startTime: serverTimestamp(),
      duration: duration,
      mode: modeName,
    }, { merge: true });
  };

  const pauseTimer = async (currentTimeLeft: number) => {
    if (!roomId) return;
    const timerRef = doc(db, "rooms", roomId, "timer", "state");
    await setDoc(timerRef, { isRunning: false, duration: currentTimeLeft }, { merge: true });
  };

  const updateSettings = async (fMins: number, bMins: number) => {
    if (!roomId) return;
    const timerRef = doc(db, "rooms", roomId, "timer", "state");
    await setDoc(timerRef, {
      focusDuration: fMins * 60,
      breakDuration: bMins * 60,
      duration: mode === "Focus" ? fMins * 60 : bMins * 60
    }, { merge: true });
  };

  return { timeLeft, isRunning, mode, durations, startTimer, pauseTimer, updateSettings };
}