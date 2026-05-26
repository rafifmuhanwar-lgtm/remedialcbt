import { useEffect, useState, useRef } from "react";
import { doc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useAntiCheat(exam, attempt, isLocked, onLock) {
  const [wakeLock, setWakeLock] = useState(null);
  const violationTimer = useRef(null);

  const logActivity = async (type, desc) => {
    if (!attempt?.id || !exam?.id) return;
    try {
      await addDoc(collection(db, "examActivityLogs"), {
        attemptId: attempt.id,
        examId: exam.id,
        activityType: type,
        description: desc,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Log error", e);
    }
  };

  const handleViolation = async (reason, type) => {
    if (isLocked) return; // Already locked
    if (violationTimer.current) clearTimeout(violationTimer.current);

    await logActivity(type, reason);
    onLock(reason);
  };

  useEffect(() => {
    if (!exam || !attempt || isLocked || !exam.antiCheatEnabled) return;

    // 1. Wake Lock (Anti Sleep)
    const requestWakeLock = async () => {
      if (exam.antiSleepEnabled && 'wakeLock' in navigator) {
        try {
          const lock = await navigator.wakeLock.request('screen');
          setWakeLock(lock);
          logActivity('wake_lock_enabled', 'Wake Lock berhasil diaktifkan');
        } catch (err) {
          console.error(`${err.name}, ${err.message}`);
          logActivity('wake_lock_not_supported', 'Browser menolak Wake Lock');
        }
      }
    };
    requestWakeLock();

    // 2. Tab Switch / Hidden
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation("Terdeteksi pindah tab atau aplikasi disembunyikan.", "page_hidden");
      } else {
        requestWakeLock(); // Re-request when back
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // 3. Browser Blur (hilang fokus)
    const handleBlur = () => {
      // Blur can be triggered by keyboard or alert, need small delay
      violationTimer.current = setTimeout(() => {
        handleViolation("Browser kehilangan fokus. Terdeteksi membuka aplikasi lain.", "browser_blur");
      }, 3000); // 3 sec tolerance
    };
    const handleFocus = () => {
      if (violationTimer.current) clearTimeout(violationTimer.current);
    };
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    // 4. Fullscreen
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation("Terdeteksi keluar dari layar penuh (Fullscreen).", "fullscreen_exited");
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // 5. Resize (Split Screen / Floating Window)
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;

      const widthRatio = currentWidth / screenWidth;
      const heightRatio = currentHeight / screenHeight;

      if (exam.splitScreenDetectionEnabled || exam.floatingWindowDetectionEnabled) {
        // Toleransi resize (keyboard, orientasi, address bar)
        if (widthRatio < 0.8 || heightRatio < 0.6) {
          if (violationTimer.current) clearTimeout(violationTimer.current);
          violationTimer.current = setTimeout(() => {
             handleViolation("Terdeteksi penggunaan Split Screen, Pop-up View, atau ukuran layar tidak normal.", "resize_violation");
          }, 3000); // 3 sec tolerance to check if it persists
        } else {
          if (violationTimer.current) clearTimeout(violationTimer.current);
        }
      }
    };
    window.addEventListener("resize", handleResize);

    // 6. Disable Copy Paste & Shortcuts
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'u' || e.key === 's' || e.key === 'p')
      ) {
        e.preventDefault();
        logActivity("shortcut_blocked", `Pencegahan shortcut ${e.key}`);
      }
    };
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      if (violationTimer.current) clearTimeout(violationTimer.current);
      if (wakeLock !== null && wakeLock.release) {
        wakeLock.release().then(() => logActivity('wake_lock_released', 'Wake Lock dilepas'));
      }
    };
  }, [exam, attempt, isLocked]);

  return { wakeLock };
}
