import { useEffect, useState, useRef, useCallback } from "react";

export function useAntiCheat(exam, attempt, isLocked, onLock) {
  const wakeLockRef = useRef(null);
  const resizeTimer = useRef(null);
  const blurRecorded = useRef(false);
  const isLockedRef = useRef(isLocked);

  // Keep ref in sync with state
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

  const logActivity = useCallback((type, desc, isViolation = false) => {
    if (!attempt?.id || !exam?.id) return;
    try {
      const storageKey = `exam_violations_${attempt.id}`;
      const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
      existing.push({
        type,
        reason: desc,
        timestamp: Date.now(),
        isViolation
      });
      localStorage.setItem(storageKey, JSON.stringify(existing));
    } catch (e) {
      console.error("Local log error", e);
    }
  }, [attempt?.id, exam?.id]);

  const handleViolation = useCallback(async (reason, type) => {
    if (isLockedRef.current) return;
    await logActivity(type, reason, true);
    onLock(reason);
  }, [logActivity, onLock]);

  useEffect(() => {
    if (!exam || !attempt || isLocked || !exam.antiCheatEnabled) return;

    // ================================================================
    // 1. WAKE LOCK (Anti Sleep)
    // ================================================================
    const requestWakeLock = async () => {
      if (exam.antiSleepEnabled && 'wakeLock' in navigator) {
        try {
          const lock = await navigator.wakeLock.request('screen');
          wakeLockRef.current = lock;
          logActivity('wake_lock_enabled', 'Wake Lock berhasil diaktifkan');
        } catch (err) {
          console.error(`${err.name}, ${err.message}`);
          logActivity('wake_lock_not_supported', 'Browser menolak Wake Lock');
        }
      }
    };
    requestWakeLock();

    // ================================================================
    // 2. CONTENT BLANKING — Proteksi screenshot mobile & desktop
    //    Saat layar hidden atau blur, konten langsung di-blank
    //    Jadi screenshot/screen record hanya dapat layar kosong
    // ================================================================
    const blankOverlay = document.createElement('div');
    blankOverlay.id = 'anti-screenshot-overlay';
    blankOverlay.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: #1a1a2e;
      display: none;
      align-items: center; justify-content: center;
      color: #e74c3c; font-size: 18px; font-weight: bold;
      font-family: system-ui, sans-serif;
      text-align: center; padding: 20px;
    `;
    blankOverlay.innerHTML = `
      <div>
        <div style="font-size:48px;margin-bottom:16px">🚫</div>
        <div>PELANGGARAN TERDETEKSI</div>
        <div style="font-size:13px;color:#999;margin-top:8px">Screenshot / Aktivitas mencurigakan terdeteksi</div>
      </div>
    `;
    document.body.appendChild(blankOverlay);

    const showBlank = () => { blankOverlay.style.display = 'flex'; };
    const hideBlank = () => { blankOverlay.style.display = 'none'; };

    // ================================================================
    // 3. VISIBILITY CHANGE — Tab switch / app switch / screenshot
    //    Screenshot di Android/iOS menyebabkan visibilitychange brief
    // ================================================================
    const handleVisibilityChange = () => {
      if (document.hidden) {
        showBlank(); // Blank konten SEGERA supaya screenshot dapat layar kosong
        handleViolation(
          "Terdeteksi pindah tab, aplikasi disembunyikan, atau percobaan screenshot.",
          "page_hidden"
        );
      } else {
        hideBlank();
        requestWakeLock();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ================================================================
    // 4. BLUR — Deteksi floating app / bola mengambang / app lain
    //    BUG FIX: Sebelumnya timer di-cancel oleh focus, jadi floating
    //    app yang cepat return focus tidak terdeteksi.
    //    SEKARANG: Blur langsung = VIOLATION, tidak bisa di-cancel.
    //    Toleransi hanya untuk input keyboard (300ms).
    // ================================================================
    const handleBlur = () => {
      if (isLockedRef.current) return;

      // Cek apakah blur karena keyboard muncul (input/textarea aktif)
      const activeEl = document.activeElement;
      const isInputFocused = activeEl && (
        activeEl.tagName === 'INPUT' ||
        activeEl.tagName === 'TEXTAREA' ||
        activeEl.tagName === 'SELECT'
      );

      if (isInputFocused) {
        // Keyboard muncul — beri toleransi 500ms, tapi TETAP cek
        // Gunakan timer TERPISAH dari resize timer
        blurRecorded.current = false;
        setTimeout(() => {
          if (!document.hasFocus() && !isLockedRef.current && !blurRecorded.current) {
            blurRecorded.current = true;
            showBlank();
            handleViolation(
              "Browser kehilangan fokus. Terdeteksi membuka aplikasi lain atau floating app (bola mengambang).",
              "browser_blur"
            );
          }
        }, 500);
      } else {
        // Bukan input — LANGSUNG violation, tidak ada toleransi
        // Ini akan menangkap floating ball app seperti QuestionAI
        blurRecorded.current = true;
        showBlank();
        handleViolation(
          "Browser kehilangan fokus. Terdeteksi membuka aplikasi lain atau floating app (bola mengambang).",
          "browser_blur"
        );
      }
    };
    const handleFocus = () => {
      hideBlank();
      blurRecorded.current = false;
      // TIDAK cancel violation — violation sudah tercatat
    };
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    // ================================================================
    // 5. FULLSCREEN EXIT
    // ================================================================
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        handleViolation("Terdeteksi keluar dari layar penuh (Fullscreen).", "fullscreen_exited");
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // ================================================================
    // 6. RESIZE — Split screen / floating window
    //    Timer TERPISAH dari blur (fix bug timer conflict)
    // ================================================================
    const handleResize = () => {
      const currentWidth = window.innerWidth;
      const currentHeight = window.innerHeight;
      const screenWidth = window.screen.width;
      const screenHeight = window.screen.height;
      const widthRatio = currentWidth / screenWidth;
      const heightRatio = currentHeight / screenHeight;

      if (exam.splitScreenDetectionEnabled || exam.floatingWindowDetectionEnabled) {
        if (widthRatio < 0.8 || heightRatio < 0.6) {
          if (resizeTimer.current) clearTimeout(resizeTimer.current);
          resizeTimer.current = setTimeout(() => {
            handleViolation(
              "Terdeteksi penggunaan Split Screen, Pop-up View, atau ukuran layar tidak normal.",
              "resize_violation"
            );
          }, 2000);
        } else {
          if (resizeTimer.current) clearTimeout(resizeTimer.current);
        }
      }
    };
    window.addEventListener("resize", handleResize);

    // ================================================================
    // 7. KEYBOARD SHORTCUT BLOCKING + SCREENSHOT KEY DETECTION
    // ================================================================
    const handleContextMenu = (e) => e.preventDefault();
    const handleKeyDown = (e) => {
      // Block copy/paste/print shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        ['c', 'v', 'x', 'u', 's', 'p', 'a'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        logActivity("shortcut_blocked", `Pencegahan shortcut ${e.key}`);
      }

      // PrintScreen key (Desktop)
      if (e.key === 'PrintScreen' || e.key === 'Snapshot') {
        e.preventDefault();
        showBlank();
        handleViolation("Terdeteksi percobaan mengambil screenshot (PrintScreen).", "screenshot_printscreen");
      }

      // Snipping Tool — Win+Shift+S
      if (e.shiftKey && (e.metaKey || e.key === 'Meta') && e.key.toLowerCase() === 's') {
        e.preventDefault();
        showBlank();
        handleViolation("Terdeteksi percobaan mengambil screenshot (Snipping Tool).", "screenshot_snipping");
      }

      // Mac screenshot — Cmd+Shift+3/4/5
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        showBlank();
        handleViolation("Terdeteksi percobaan mengambil screenshot (Mac).", "screenshot_mac");
      }

      // F12 / Ctrl+Shift+I — DevTools
      if (e.key === 'F12' || ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i')) {
        e.preventDefault();
        handleViolation("Terdeteksi percobaan membuka Developer Tools.", "devtools_shortcut");
      }
    };
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    // ================================================================
    // 8. PASTE IMAGE DETECTION — Screenshot paste
    // ================================================================
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

    // ================================================================
    // 9. AGGRESSIVE FOCUS POLLING — Deteksi floating app overlay
    //    Floating apps (QuestionAI ball) bisa aktif TANPA menyebabkan
    //    blur event. Polling hasFocus() setiap 1 detik.
    // ================================================================
    const focusPollInterval = setInterval(() => {
      if (isLockedRef.current) return;

      // Jika browser tidak punya fokus DAN halaman tidak hidden
      // = ada sesuatu di atas browser (floating app / overlay)
      if (!document.hasFocus() && !document.hidden) {
        showBlank();
        handleViolation(
          "Terdeteksi aplikasi mengambang (floating app/bola AI) aktif di atas layar ujian. Tutup semua aplikasi overlay!",
          "floating_app_detected"
        );
      }
    }, 1000); // Setiap 1 detik

    // ================================================================
    // 10. SCREEN CAPTURE API — Intercept recording
    // ================================================================
    let originalGetDisplayMedia = null;
    try {
      if (navigator.mediaDevices?.getDisplayMedia) {
        originalGetDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
        navigator.mediaDevices.getDisplayMedia = async function (...args) {
          handleViolation("Terdeteksi percobaan screen recording.", "screen_capture_attempt");
          throw new DOMException('Blocked by exam security', 'NotAllowedError');
        };
      }
    } catch (e) { /* silent */ }

    // ================================================================
    // 11. DEVTOOLS DETECTION — Monitor window size gap
    // ================================================================
    const devtoolsInterval = setInterval(() => {
      if (isLockedRef.current) return;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > 160 || heightDiff > 160) {
        handleViolation("Terdeteksi Developer Tools terbuka.", "devtools_detected");
      }
    }, 3000);

    // ================================================================
    // 12. CSS PROTECTION — Anti user-select + anti screenshot hints
    // ================================================================
    const style = document.createElement('style');
    style.id = 'anti-cheat-style';
    style.textContent = `
      body, body * {
        -webkit-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
      }
      input, textarea, select {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      /* Cegah drag */
      img, a { 
        -webkit-user-drag: none !important;
        user-drag: none !important;
      }
    `;
    if (!document.getElementById('anti-cheat-style')) {
      document.head.appendChild(style);
    }

    // ================================================================
    // 13. TOUCH MONITOR — Deteksi multi-touch & overlay patterns
    //     Floating ball apps kadang inject touch events
    // ================================================================
    let lastTouchTime = 0;
    const handleTouchStart = (e) => {
      const now = Date.now();
      // Deteksi multi-touch yang mencurigakan (>2 jari = mungkin gesture)
      if (e.touches.length > 2) {
        handleViolation(
          "Terdeteksi gesture multi-touch mencurigakan.",
          "suspicious_multitouch"
        );
      }
      lastTouchTime = now;
    };
    document.addEventListener("touchstart", handleTouchStart, { passive: true });

    // ================================================================
    // 14. WINDOW OPEN INTERCEPT — Block popup/new window
    // ================================================================
    const originalWindowOpen = window.open;
    window.open = function () {
      handleViolation("Terdeteksi percobaan membuka window baru.", "window_open_blocked");
      return null;
    };

    // ================================================================
    // CLEANUP
    // ================================================================
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("touchstart", handleTouchStart);

      if (resizeTimer.current) clearTimeout(resizeTimer.current);
      clearInterval(focusPollInterval);
      clearInterval(devtoolsInterval);

      if (wakeLockRef.current !== null && wakeLockRef.current.release) {
        wakeLockRef.current.release().then(() => logActivity('wake_lock_released', 'Wake Lock dilepas'));
      }

      // Restore intercepted APIs
      if (originalGetDisplayMedia && navigator.mediaDevices) {
        navigator.mediaDevices.getDisplayMedia = originalGetDisplayMedia;
      }
      window.open = originalWindowOpen;

      // Remove injected elements
      const overlay = document.getElementById('anti-screenshot-overlay');
      if (overlay) overlay.remove();
      const styleEl = document.getElementById('anti-cheat-style');
      if (styleEl) styleEl.remove();
    };
  }, [exam, attempt, isLocked, logActivity, handleViolation]);

  return { wakeLock: wakeLockRef.current };
}
