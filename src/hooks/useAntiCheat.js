import { useEffect, useState, useRef } from "react";
import { doc, updateDoc, serverTimestamp, collection, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function useAntiCheat(exam, attempt, isLocked, onLock) {
  const [wakeLock, setWakeLock] = useState(null);
  const violationTimer = useRef(null);
  const lastResizeTime = useRef(0);
  const initialScreenSize = useRef(null);
  const touchTracker = useRef({ overlayDetected: false });

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

    // Store initial screen dimensions for comparison
    if (!initialScreenSize.current) {
      initialScreenSize.current = {
        width: window.screen.width,
        height: window.screen.height,
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight
      };
    }

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

    // 3. Browser Blur (hilang fokus) — juga mendeteksi floating app overlay
    const handleBlur = () => {
      // Blur can be triggered by keyboard or alert, need small delay
      violationTimer.current = setTimeout(() => {
        handleViolation("Browser kehilangan fokus. Terdeteksi membuka aplikasi lain atau floating app (bola mengambang).", "browser_blur");
      }, 1500); // Reduced to 1.5 sec — floating apps trigger blur quickly
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

    // 5. Resize (Split Screen / Floating Window / Floating Ball App)
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
      // Block copy/paste/print shortcuts
      if (
        (e.ctrlKey || e.metaKey) && 
        (e.key === 'c' || e.key === 'v' || e.key === 'x' || e.key === 'u' || e.key === 's' || e.key === 'p')
      ) {
        e.preventDefault();
        logActivity("shortcut_blocked", `Pencegahan shortcut ${e.key}`);
      }

      // 7. Screenshot Detection — PrintScreen key (Desktop)
      if (e.key === 'PrintScreen' || e.key === 'Snapshot') {
        e.preventDefault();
        handleViolation("Terdeteksi percobaan mengambil screenshot (PrintScreen).", "screenshot_attempt");
      }

      // Detect Snipping Tool / Windows shortcut (Win+Shift+S)
      if ((e.metaKey || e.key === 'Meta') && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        handleViolation("Terdeteksi percobaan mengambil screenshot (Snipping Tool).", "screenshot_snipping");
      }

      // Detect Mac screenshot shortcuts (Cmd+Shift+3, Cmd+Shift+4, Cmd+Shift+5)
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        handleViolation("Terdeteksi percobaan mengambil screenshot (Mac Screenshot).", "screenshot_mac");
      }
    };
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    // 8. Screenshot Detection — CSS-based screen capture blocking
    // Apply CSS to prevent screen recording/screenshot on supported browsers
    const applyScreenshotProtection = () => {
      const style = document.createElement('style');
      style.id = 'anti-screenshot-style';
      style.textContent = `
        /* Prevent screen capture on some mobile browsers */
        @media screen {
          .exam-protected-content {
            -webkit-user-select: none !important;
            user-select: none !important;
          }
        }
        /* DRM-like protection for supporting browsers */
        @media (display-mode: fullscreen) {
          body {
            -webkit-user-select: none !important;
            user-select: none !important;
          }
        }
      `;
      if (!document.getElementById('anti-screenshot-style')) {
        document.head.appendChild(style);
      }
    };
    applyScreenshotProtection();

    // 9. Screenshot Detection — Using navigator.clipboard & Permissions API
    // Monitor clipboard for screenshot paste attempts
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            handleViolation("Terdeteksi percobaan paste screenshot/gambar.", "clipboard_screenshot");
            return;
          }
        }
      }
    };
    document.addEventListener("paste", handlePaste);

    // 10. Screenshot Detection — Screen Capture API monitoring
    // Detect if screen is being recorded/captured
    const monitorScreenCapture = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          // Intercept getDisplayMedia calls
          const originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
          navigator.mediaDevices.getDisplayMedia = async function(...args) {
            handleViolation("Terdeteksi percobaan screen recording/capture.", "screen_capture_attempt");
            throw new DOMException('Screen capture blocked by exam security', 'NotAllowedError');
          };
        }
      } catch (e) {
        // Silent — not all browsers support this
      }
    };
    monitorScreenCapture();

    // 11. Floating App / Overlay Detection (QuestionAI ball, etc.)
    // Floating apps create an overlay that intercepts touch events outside the browser viewport
    const detectFloatingOverlay = () => {
      // Method A: Monitor for suspicious touch events that indicate overlay
      let suspiciousTouchCount = 0;
      const touchStartHandler = (e) => {
        // If touch starts at edges (common for floating ball apps)
        const touch = e.touches[0];
        if (touch) {
          const screenW = window.screen.width;
          const screenH = window.screen.height;
          // Floating balls are typically at screen edges
          const isEdgeTouch = (
            touch.clientX < 20 || touch.clientX > screenW - 20 ||
            touch.clientY < 20 || touch.clientY > screenH - 20
          );
          // Not necessarily a violation for edge touch alone
        }
      };
      document.addEventListener("touchstart", touchStartHandler, { passive: true });

      // Method B: Monitor window.outerWidth/Height changes (floating app resizes viewport)
      const overlayCheckInterval = setInterval(() => {
        if (isLocked) return;
        
        const outerW = window.outerWidth;
        const outerH = window.outerHeight;
        const innerW = window.innerWidth;
        const innerH = window.innerHeight;
        
        // On mobile, if there's a significant gap between outer and inner,
        // it might indicate a floating overlay app
        const widthGap = Math.abs(outerW - innerW);
        const heightGap = Math.abs(outerH - innerH);
        
        // Check if browser has lost focus silently (floating apps can do this)
        if (!document.hasFocus() && !document.hidden && !isLocked) {
          handleViolation(
            "Terdeteksi aplikasi mengambang (floating app/bola AI) aktif di atas layar ujian. Segera tutup aplikasi tersebut.",
            "floating_app_detected"
          );
        }
      }, 2000); // Check every 2 seconds

      // Method C: Detect picture-in-picture or multi-window
      if ('documentPictureInPicture' in window || 'pictureInPictureEnabled' in document) {
        document.addEventListener('enterpictureinpicture', () => {
          handleViolation("Terdeteksi penggunaan Picture-in-Picture mode.", "pip_detected");
        });
      }

      return { touchStartHandler, overlayCheckInterval };
    };
    const floatingDetection = detectFloatingOverlay();

    // 12. DevTools Detection (prevents using browser inspect to cheat)
    const detectDevTools = () => {
      const threshold = 160;
      const devtoolsCheck = setInterval(() => {
        if (isLocked) return;
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        if (widthDiff > threshold || heightDiff > threshold) {
          handleViolation("Terdeteksi Developer Tools terbuka.", "devtools_detected");
        }
      }, 3000);
      return devtoolsCheck;
    };
    const devtoolsInterval = detectDevTools();

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("paste", handlePaste);
      if (violationTimer.current) clearTimeout(violationTimer.current);
      if (wakeLock !== null && wakeLock.release) {
        wakeLock.release().then(() => logActivity('wake_lock_released', 'Wake Lock dilepas'));
      }
      // Cleanup floating detection
      if (floatingDetection.overlayCheckInterval) clearInterval(floatingDetection.overlayCheckInterval);
      if (floatingDetection.touchStartHandler) {
        document.removeEventListener("touchstart", floatingDetection.touchStartHandler);
      }
      // Cleanup devtools detection
      if (devtoolsInterval) clearInterval(devtoolsInterval);
      // Remove anti-screenshot style
      const style = document.getElementById('anti-screenshot-style');
      if (style) style.remove();
    };
  }, [exam, attempt, isLocked]);

  return { wakeLock };
}
