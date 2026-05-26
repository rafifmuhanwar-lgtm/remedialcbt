"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { LockScreen } from "@/components/exam/LockScreen";
import { Clock, ChevronLeft, ChevronRight, Send, Flag, Loader2, AlertTriangle, Menu, X } from "lucide-react";

export default function KerjakanUjianPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  const [exam, setExam] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [violationCount, setViolationCount] = useState(0);
  const [showNav, setShowNav] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const timerRef = useRef(null);
  const isSubmittingRef = useRef(false);

  // Anti-cheat hook
  useAntiCheat(exam, attempt, isLocked, (reason) => {
    if (isBlocked || isSubmittingRef.current) return;
    const newCount = violationCount + 1;
    setViolationCount(newCount);
    setLockReason(reason);
    setIsLocked(true);
    if (attempt?.id) {
      updateDoc(doc(db, "studentAttempts", attempt.id), {
        violationCount: newCount,
        status: newCount >= (exam?.maxViolations || 3) ? "blocked" : "locked",
        lockedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  });

  // Load exam data, attempt, and questions
  useEffect(() => {
    const init = async () => {
      try {
        // Get session info
        let attemptInfo = null;
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith("attempt_")) {
            attemptInfo = JSON.parse(sessionStorage.getItem(key));
            break;
          }
        }
        if (!attemptInfo) { router.replace(`/ujian/${slug}`); return; }

        // Load attempt
        const attemptSnap = await getDoc(doc(db, "studentAttempts", attemptInfo.attemptId));
        if (!attemptSnap.exists()) { router.replace(`/ujian/${slug}`); return; }
        const attemptData = { id: attemptSnap.id, ...attemptSnap.data() };

        if (attemptData.status === "blocked") { setIsBlocked(true); setLoading(false); return; }
        if (attemptData.status === "submitted" || attemptData.status === "time_expired") {
          router.replace(`/ujian/${slug}/hasil`); return;
        }

        setAttempt(attemptData);
        setViolationCount(attemptData.violationCount || 0);

        // Load exam
        const examSnap = await getDoc(doc(db, "exams", attemptData.examId));
        const examData = { id: examSnap.id, ...examSnap.data() };
        setExam(examData);

        // Load questions
        const qSnap = await getDocs(query(collection(db, "questions"), where("examId", "==", examData.id)));
        let qList = [];
        qSnap.forEach(d => qList.push({ id: d.id, ...d.data() }));

        // Shuffle if needed (use attempt's questionOrder or generate)
        if (examData.shuffleQuestions && !attemptData.questionOrder) {
          const order = qList.map((_, i) => i).sort(() => Math.random() - 0.5);
          qList = order.map(i => qList[i]);
          await updateDoc(doc(db, "studentAttempts", attemptData.id), { questionOrder: order });
        } else if (attemptData.questionOrder) {
          const ordered = attemptData.questionOrder.map(i => qList[i]);
          qList = ordered.filter(Boolean);
        }
        setQuestions(qList);

        // Load existing answers
        const aSnap = await getDocs(query(collection(db, "studentAnswers"), where("attemptId", "==", attemptData.id)));
        const existingAnswers = {};
        aSnap.forEach(d => { const a = d.data(); existingAnswers[a.questionId] = { docId: d.id, answer: a.selectedOptionId || a.essayAnswer || "" }; });
        setAnswers(existingAnswers);

        // Calculate remaining time
        const startedAt = attemptData.startedAt?.toDate ? attemptData.startedAt.toDate() : new Date(attemptData.startedAt);
        const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
        const totalSec = examData.durationMinutes * 60;
        const remaining = Math.max(0, totalSec - elapsed);
        setTimeLeft(remaining);

        if (remaining <= 0) { await autoSubmit(attemptData.id); return; }

        // Request fullscreen
        try { await document.documentElement.requestFullscreen(); } catch (e) { console.warn("Fullscreen denied"); }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [slug, router]);

  // Timer
  useEffect(() => {
    if (timeLeft <= 0 || loading || isBlocked) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); autoSubmit(attempt?.id); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [loading, isBlocked, timeLeft > 0]);

  // Heartbeat: update lastActiveAt setiap 10 detik agar monitor tahu siswa masih aktif
  useEffect(() => {
    if (!attempt?.id || loading || isBlocked) return;
    const heartbeat = setInterval(async () => {
      try {
        await updateDoc(doc(db, "studentAttempts", attempt.id), {
          lastActiveAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } catch (e) { /* silent */ }
    }, 10000);
    // Send initial heartbeat immediately
    updateDoc(doc(db, "studentAttempts", attempt.id), {
      lastActiveAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }).catch(() => {});
    return () => clearInterval(heartbeat);
  }, [attempt?.id, loading, isBlocked]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // Autosave answer
  const saveAnswer = useCallback(async (questionId, value) => {
    if (!attempt?.id || !exam?.id) return;
    setAutoSaveStatus("Menyimpan...");
    const q = questions.find(q => q.id === questionId);
    const isEssay = q?.questionType === "essay";
    const answerData = {
      attemptId: attempt.id, examId: exam.id, questionId,
      selectedOptionId: isEssay ? null : value,
      essayAnswer: isEssay ? value : null,
      isCorrect: isEssay ? null : (q?.correctAnswer === value),
      score: isEssay ? 0 : (q?.correctAnswer === value ? (q?.scoreWeight || 0) : 0),
      updatedAt: serverTimestamp()
    };
    try {
      if (answers[questionId]?.docId) {
        await updateDoc(doc(db, "studentAnswers", answers[questionId].docId), answerData);
      } else {
        answerData.createdAt = serverTimestamp();
        const ref = await addDoc(collection(db, "studentAnswers"), answerData);
        setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], docId: ref.id } }));
      }
      // Update lastActiveAt & answeredCount di attempt agar monitor bisa track progress real-time
      const currentAnswered = Object.keys(answers).filter(k => answers[k]?.answer).length + (answers[questionId]?.answer ? 0 : 1);
      await updateDoc(doc(db, "studentAttempts", attempt.id), {
        lastActiveAt: serverTimestamp(),
        answeredCount: currentAnswered,
        updatedAt: serverTimestamp()
      });
      setAutoSaveStatus("Tersimpan ✓");
      setTimeout(() => setAutoSaveStatus(""), 2000);
    } catch (e) {
      console.error(e);
      setAutoSaveStatus("Gagal simpan!");
    }
  }, [attempt, exam, questions, answers]);

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], answer: value } }));
    saveAnswer(questionId, value);
  };

  const autoSubmit = async (attemptId) => {
    if (!attemptId) return;
    isSubmittingRef.current = true;
    try {
      const aSnap = await getDocs(query(collection(db, "studentAnswers"), where("attemptId", "==", attemptId)));
      let total = 0;
      aSnap.forEach(d => { total += d.data().score || 0; });
      await updateDoc(doc(db, "studentAttempts", attemptId), { status: "time_expired", score: total, submittedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      router.replace(`/ujian/${slug}/hasil`);
    } catch (e) { console.error(e); isSubmittingRef.current = false; }
  };

  const handleSubmit = async () => {
    if (!attempt?.id) return;
    setIsSubmitting(true);
    isSubmittingRef.current = true;
    try {
      const aSnap = await getDocs(query(collection(db, "studentAnswers"), where("attemptId", "==", attempt.id)));
      let total = 0;
      aSnap.forEach(d => { total += d.data().score || 0; });
      await updateDoc(doc(db, "studentAttempts", attempt.id), { status: "submitted", score: total, submittedAt: serverTimestamp(), updatedAt: serverTimestamp() });
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      router.replace(`/ujian/${slug}/hasil`);
    } catch (e) { console.error(e); setIsSubmitting(false); isSubmittingRef.current = false; }
  };

  const handleUnlock = async () => {
    setIsLocked(false);
    setLockReason("");
    if (attempt?.id) {
      await updateDoc(doc(db, "studentAttempts", attempt.id), { status: "in_progress", updatedAt: serverTimestamp() });
      await addDoc(collection(db, "examActivityLogs"), { attemptId: attempt.id, examId: exam?.id, activityType: "pin_correct", description: "PIN benar, ujian dilanjutkan", createdAt: serverTimestamp() });
    }
    try { await document.documentElement.requestFullscreen(); } catch (e) {}
  };

  const handleBlocked = async () => {
    setIsBlocked(true);
    if (attempt?.id) {
      await updateDoc(doc(db, "studentAttempts", attempt.id), { status: "blocked", updatedAt: serverTimestamp() });
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-900"><Loader2 className="w-10 h-10 animate-spin text-indigo-400" /></div>;

  if (isBlocked) return (
    <div className="min-h-screen bg-red-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ujian Diblokir</h2>
        <p className="text-gray-600">Ujian Anda telah diblokir karena terlalu sering keluar dari halaman ujian. Hubungi guru pengawas Anda.</p>
      </div>
    </div>
  );

  const currentQ = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter(k => answers[k]?.answer).length;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col select-none" onCopy={e => e.preventDefault()} onPaste={e => e.preventDefault()} onCut={e => e.preventDefault()}>
      {/* Lock Screen */}
      {isLocked && <LockScreen reason={lockReason} maxViolations={exam?.maxViolations || 3} violationCount={violationCount} onUnlock={handleUnlock} onBlocked={handleBlocked} examPin={exam?.examPin} />}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button onClick={() => setShowNav(!showNav)} className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 lg:hidden"><Menu className="w-5 h-5" /></button>
            <div className="hidden sm:block"><p className="text-sm font-bold text-gray-900 truncate max-w-[200px]">{exam?.title}</p><p className="text-xs text-gray-500">Soal {currentIndex + 1} / {questions.length}</p></div>
          </div>
          <div className={`flex items-center px-3 py-1.5 rounded-full font-mono text-sm font-bold ${timeLeft < 60 ? "bg-red-100 text-red-700 animate-pulse" : timeLeft < 300 ? "bg-yellow-100 text-yellow-700" : "bg-indigo-100 text-indigo-700"}`}>
            <Clock className="w-4 h-4 mr-1.5" />{formatTime(timeLeft)}
          </div>
          <div className="flex items-center space-x-2">
            {violationCount > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">⚠ {violationCount}/{exam?.maxViolations || 3}</span>}
            {autoSaveStatus && <span className="text-xs text-green-600 hidden sm:inline">{autoSaveStatus}</span>}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Side Navigation */}
        <aside className={`${showNav ? "fixed inset-0 z-40 flex" : "hidden"} lg:relative lg:flex lg:z-auto`}>
          <div className={`${showNav ? "fixed inset-0 bg-black/30" : "hidden"} lg:hidden`} onClick={() => setShowNav(false)}></div>
          <div className="relative z-50 w-64 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center lg:hidden">
              <span className="font-bold text-gray-900">Navigasi Soal</span>
              <button onClick={() => setShowNav(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 grid grid-cols-5 gap-2">
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => { setCurrentIndex(i); setShowNav(false); }}
                  className={`w-10 h-10 rounded-lg text-sm font-bold transition-all ${
                    i === currentIndex ? "bg-indigo-600 text-white ring-2 ring-indigo-300" :
                    answers[q.id]?.answer ? "bg-green-100 text-green-800 border border-green-300" :
                    flagged[q.id] ? "bg-yellow-100 text-yellow-800 border border-yellow-300" :
                    "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>{i + 1}</button>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 mt-auto space-y-2 text-xs text-gray-500">
              <div className="flex items-center"><span className="w-3 h-3 rounded bg-green-200 mr-2"></span> Terjawab ({answeredCount})</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded bg-yellow-200 mr-2"></span> Ragu-ragu</div>
              <div className="flex items-center"><span className="w-3 h-3 rounded bg-gray-200 mr-2"></span> Belum ({questions.length - answeredCount})</div>
            </div>
            <div className="p-4 border-t border-gray-100">
              <button onClick={() => { setShowNav(false); setShowConfirm(true); }} className="w-full py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center">
                <Send className="w-4 h-4 mr-2" /> Submit Ujian
              </button>
            </div>
          </div>
        </aside>

        {/* Question Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {currentQ && (
            <div className="max-w-3xl mx-auto">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-4">
                <div className="flex justify-between items-start mb-4">
                  <span className="text-xs font-semibold text-gray-400 uppercase">{currentQ.questionType === "multiple_choice" ? "Pilihan Ganda" : currentQ.questionType === "true_false" ? "Benar / Salah" : "Essay"} · Bobot: {currentQ.scoreWeight}</span>
                  <button onClick={() => setFlagged(p => ({ ...p, [currentQ.id]: !p[currentQ.id] }))} className={`p-1.5 rounded-lg transition-colors ${flagged[currentQ.id] ? "bg-yellow-100 text-yellow-600" : "bg-gray-100 text-gray-400 hover:text-yellow-500"}`}><Flag className="w-4 h-4" /></button>
                </div>
                <h2 className="text-lg font-semibold text-gray-900 leading-relaxed">{currentIndex + 1}. {currentQ.questionText}</h2>
              </div>

              {/* Multiple Choice */}
              {currentQ.questionType === "multiple_choice" && currentQ.options && (
                <div className="space-y-3">
                  {currentQ.options.map((opt, i) => (
                    <button key={i} onClick={() => handleAnswer(currentQ.id, opt)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                        answers[currentQ.id]?.answer === opt
                          ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}>
                      <div className="flex items-center">
                        <span className={`w-8 h-8 flex items-center justify-center rounded-full mr-3 text-sm font-bold ${
                          answers[currentQ.id]?.answer === opt ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600"
                        }`}>{String.fromCharCode(65 + i)}</span>
                        <span className="text-gray-800">{opt}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* True/False */}
              {currentQ.questionType === "true_false" && (
                <div className="grid grid-cols-2 gap-4">
                  {["true", "false"].map(val => (
                    <button key={val} onClick={() => handleAnswer(currentQ.id, val)}
                      className={`p-6 rounded-xl border-2 text-center font-bold text-lg transition-all ${
                        answers[currentQ.id]?.answer === val
                          ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300 text-indigo-700"
                          : "border-gray-200 bg-white hover:border-gray-300 text-gray-700"
                      }`}>{val === "true" ? "Benar" : "Salah"}</button>
                  ))}
                </div>
              )}

              {/* Essay */}
              {currentQ.questionType === "essay" && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <textarea rows="6" value={answers[currentQ.id]?.answer || ""} onChange={(e) => handleAnswer(currentQ.id, e.target.value)}
                    className="w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 p-3 border text-sm" placeholder="Ketik jawaban Anda di sini..." />
                </div>
              )}

              {/* Nav Buttons */}
              <div className="flex justify-between mt-6">
                <button disabled={currentIndex === 0} onClick={() => setCurrentIndex(p => p - 1)} className="flex items-center px-5 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Sebelumnya
                </button>
                {currentIndex < questions.length - 1 ? (
                  <button onClick={() => setCurrentIndex(p => p + 1)} className="flex items-center px-5 py-3 bg-indigo-600 rounded-xl text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
                    Berikutnya <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                ) : (
                  <button onClick={() => setShowConfirm(true)} className="flex items-center px-5 py-3 bg-green-600 rounded-xl text-sm font-medium text-white hover:bg-green-700 transition-colors">
                    <Send className="w-4 h-4 mr-2" /> Submit
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Submit Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Konfirmasi Submit</h3>
            <p className="text-sm text-gray-600 mb-1">Terjawab: <strong>{answeredCount}</strong> dari {questions.length} soal.</p>
            {answeredCount < questions.length && <p className="text-sm text-orange-600 mb-4">⚠ Masih ada {questions.length - answeredCount} soal belum dijawab.</p>}
            <p className="text-sm text-gray-500 mb-6">Setelah submit, Anda tidak bisa mengubah jawaban.</p>
            <div className="flex space-x-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Kembali</button>
              <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 disabled:opacity-70">
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Ya, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
