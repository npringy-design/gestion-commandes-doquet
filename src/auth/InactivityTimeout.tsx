import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';

// Delai volontairement long : en service commande, l'application peut rester ouverte
// sans action continue. Un delai trop court provoque des deconnexions operationnelles.
const INACTIVITY_WARNING_MS = 2 * 60 * 60 * 1000;
const COUNTDOWN_MS = 15 * 60 * 1000;
const COUNTDOWN_TICK_MS = 1000;

const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

const ACTIVITY_EVENTS = [
  'pointerdown',
  'keydown',
  'wheel',
  'touchstart',
  'visibilitychange',
] as const;

const InactivityTimeout: React.FC = () => {
  const { user, signOut } = useAuth();
  const [warningVisible, setWarningVisible] = useState(false);
  const [remainingMs, setRemainingMs] = useState(COUNTDOWN_MS);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number>(0);
  const warningVisibleRef = useRef(false);

  useEffect(() => {
    warningVisibleRef.current = warningVisible;
  }, [warningVisible]);

  const clearTimers = () => {
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    warningTimerRef.current = null;
    logoutTimerRef.current = null;
    tickTimerRef.current = null;
  };

  const startWarning = () => {
    deadlineRef.current = Date.now() + COUNTDOWN_MS;
    setRemainingMs(COUNTDOWN_MS);
    setWarningVisible(true);

    logoutTimerRef.current = setTimeout(() => {
      void signOut();
    }, COUNTDOWN_MS);

    tickTimerRef.current = setInterval(() => {
      setRemainingMs(deadlineRef.current - Date.now());
    }, COUNTDOWN_TICK_MS);
  };

  const resetTimer = () => {
    clearTimers();
    setWarningVisible(false);
    setRemainingMs(COUNTDOWN_MS);
    warningTimerRef.current = setTimeout(startWarning, INACTIVITY_WARNING_MS);
  };

  useEffect(() => {
    if (!user) {
      clearTimers();
      setWarningVisible(false);
      return;
    }

    const onActivity = () => {
      resetTimer();
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, onActivity, { passive: true });
    });

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, onActivity);
      });
    };
  }, [user?.id]);

  const countdown = useMemo(() => formatCountdown(remainingMs), [remainingMs]);

  if (!user || !warningVisible) return null;

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border-4 border-red-600 bg-white p-6 text-center shadow-2xl">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-red-700">Session inactive</p>
        <h2 className="mt-2 text-2xl font-black uppercase text-slate-900">Deconnexion automatique</h2>
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Sans action de ta part, tu seras deconnecte dans
        </p>
        <div className="mt-4 text-5xl font-black tabular-nums text-red-700">{countdown}</div>
        <button
          type="button"
          onClick={resetTimer}
          className="mt-6 w-full rounded-2xl bg-slate-900 py-3 text-sm font-black uppercase tracking-widest text-white"
        >
          Rester connecte
        </button>
      </div>
    </div>
  );
};

export default InactivityTimeout;
