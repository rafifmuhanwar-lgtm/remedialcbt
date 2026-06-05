"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Printer, X, Loader2 } from "lucide-react";

function PrintContent() {
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("id");

  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!attemptId) return;

    const fetchData = async () => {
      try {
        // Fetch attempt
        const attemptSnap = await getDoc(doc(db, "studentAttempts", attemptId));
        if (!attemptSnap.exists()) {
          alert("Data attempt tidak ditemukan.");
          window.close();
          return;
        }
        const attemptData = { id: attemptSnap.id, ...attemptSnap.data() };
        setAttempt(attemptData);

        // Fetch exam
        const examSnap = await getDoc(doc(db, "exams", attemptData.examId));
        if (examSnap.exists()) {
          setExam({ id: examSnap.id, ...examSnap.data() });
        }

        // Fetch questions
        const qSnap = await getDocs(query(collection(db, "questions"), where("examId", "==", attemptData.examId)));
        const qList = [];
        qSnap.forEach(d => qList.push({ id: d.id, ...d.data() }));
        setQuestions(qList);

      } catch (err) {
        console.error("Gagal memuat data cetak:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [attemptId]);

  useEffect(() => {
    if (!loading && attempt && exam) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, attempt, exam]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
        <p className="text-gray-500 font-medium">Menyiapkan Laporan Cetak...</p>
      </div>
    );
  }

  if (!attempt || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-red-500 font-medium">Data tidak lengkap atau gagal dimuat.</p>
      </div>
    );
  }

  const isPassed = (attempt.score || 0) >= (exam.minimumScore || 75);
  const startedAtDate = attempt.startedAt?.toDate ? attempt.startedAt.toDate() : (attempt.startedAt ? new Date(attempt.startedAt) : null);
  const submittedAtDate = attempt.submittedAt?.toDate ? attempt.submittedAt.toDate() : (attempt.submittedAt ? new Date(attempt.submittedAt) : null);
  
  let durationStr = "-";
  if (startedAtDate && submittedAtDate) {
    const diffMs = submittedAtDate.getTime() - startedAtDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffSecs = Math.floor((diffMs % 60000) / 1000);
    durationStr = `${diffMins} menit ${diffSecs} detik`;
  }
  const submitDateStr = submittedAtDate ? submittedAtDate.toLocaleString("id-ID", {
    dateStyle: "long",
    timeStyle: "short"
  }) : "-";

  const actualViolations = (attempt.violations || []).filter(v => 
    v.isViolation || 
    (v.type && !['wake_lock_enabled', 'wake_lock_released', 'wake_lock_not_supported', 'shortcut_blocked'].includes(v.type))
  );
  const violationCount = actualViolations.length;

  return (
    <div className="bg-white min-h-screen p-4 md:p-8 text-gray-800 font-sans">
      {/* Action Bar (hidden in print) */}
      <div className="print:hidden flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-6 py-3 mb-6 shadow-sm">
        <span className="font-semibold text-slate-700 text-sm">Mode Pratinjau Cetak</span>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer">
            <Printer className="w-4 h-4" /> Cetak
          </button>
          <button onClick={() => window.close()} className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-1.5 transition-colors cursor-pointer">
            <X className="w-4 h-4" /> Tutup
          </button>
        </div>
      </div>

      {/* Report Container */}
      <div className="max-w-4xl mx-auto border border-slate-200 p-8 rounded-2xl shadow-sm print:border-0 print:p-0 print:shadow-none">
        
        {/* Header */}
        <div className="text-center border-b-4 border-double border-slate-300 pb-5 mb-8">
          <h1 className="text-2xl font-black text-slate-900 tracking-wide uppercase">Laporan Detail Hasil Ujian</h1>
          <p className="text-xs text-slate-500 mt-1 uppercase font-semibold tracking-wider">Web Remedial CBT · Laporan Penilaian</p>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Student Profile Card */}
          <div className="md:col-span-2 border border-slate-200 rounded-xl p-5 bg-slate-50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 border-b border-slate-200 pb-1.5">Profil Siswa & Detail Sesi</h3>
            <table className="w-full text-xs">
              <tbody>
                <tr className="border-b border-slate-100"><td className="py-2 text-slate-500 w-1/3">Nama Lengkap</td><td className="py-2 font-bold text-slate-900">{attempt.studentName}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Kelas / Rombel</td><td className="py-2 font-bold text-slate-900">{attempt.className || "-"}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Nomor Absen</td><td className="py-2 font-bold text-slate-900">{attempt.studentNumber || "-"}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Mata Ujian</td><td className="py-2 font-bold text-slate-900">{exam.title}</td></tr>
                <tr className="border-b border-slate-100"><td className="py-2 text-slate-500">Waktu Pengumpulan</td><td className="py-2 font-bold text-slate-900">{submitDateStr}</td></tr>
                <tr><td className="py-2 text-slate-500">Durasi Pengerjaan</td><td className="py-2 font-bold text-slate-900">{durationStr}</td></tr>
              </tbody>
            </table>
          </div>

          {/* Score Summary Card */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 flex flex-col items-center justify-center text-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Nilai Akhir</h3>
            <div className="text-5xl font-black text-indigo-600 mb-2 leading-none">{attempt.score || 0}</div>
            <div className="text-[10px] text-slate-500 font-semibold mb-3">KKM / Batas Kelulusan: {exam.minimumScore || 75}</div>
            <div className={`px-4 py-1.5 rounded-full text-xs font-black tracking-wider uppercase shadow-sm border ${
              isPassed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
            }`}>
              {isPassed ? "LULUS" : "BELUM LULUS"}
            </div>
          </div>
        </div>

        {/* Security Log */}
        <div className="mb-8 font-sans">
          <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide mb-3 border-b-2 border-slate-200 pb-1.5">Log Keamanan & Integritas</h3>
          {violationCount > 0 ? (
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                  <th className="border border-slate-200 p-2.5 text-center w-[5%]">No</th>
                  <th className="border border-slate-200 p-2.5 w-[15%]">Waktu</th>
                  <th className="border border-slate-200 p-2.5 w-[25%]">Tipe Pelanggaran</th>
                  <th className="border border-slate-200 p-2.5">Keterangan</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {actualViolations.map((v, idx) => (
                  <tr key={idx} className="bg-rose-50/50 text-rose-950">
                    <td className="border border-slate-200 p-2.5 text-center font-bold">{idx + 1}</td>
                    <td className="border border-slate-200 p-2.5">{new Date(v.timestamp).toLocaleTimeString("id-ID")}</td>
                    <td className="border border-slate-200 p-2.5 font-bold uppercase tracking-wider text-[10px]">{v.type?.replace("_", " ")}</td>
                    <td className="border border-slate-200 p-2.5">{v.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="border border-emerald-200 bg-emerald-50/50 text-emerald-950 p-4 rounded-lg text-xs flex items-start gap-2">
              <span className="text-base leading-none">🛡️</span>
              <div>
                <strong className="block text-emerald-800">Sangat Baik / Jujur</strong>
                Tidak ada indikasi kecurangan atau pelanggaran keamanan yang terdeteksi selama pengerjaan ujian.
              </div>
            </div>
          )}
        </div>

        {/* Answers Breakdown */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide mb-3 border-b-2 border-slate-200 pb-1.5">Lembar Jawaban & Analisis Soal</h3>
          <table className="w-full text-left border-collapse border border-slate-200">
            <thead>
              <tr className="bg-slate-100 text-[10px] font-bold text-slate-600 uppercase">
                <th className="border border-slate-200 p-2.5 text-center w-[5%]">No</th>
                <th className="border border-slate-200 p-2.5 w-[45%]">Pertanyaan</th>
                <th className="border border-slate-200 p-2.5 w-[15%]">Tipe Soal</th>
                <th className="border border-slate-200 p-2.5 w-[15%]">Jawaban</th>
                <th className="border border-slate-200 p-2.5 w-[15%]">Kunci</th>
                <th className="border border-slate-200 p-2.5 text-center w-[8%]">Status</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {questions.length === 0 ? (
                <tr><td colSpan="6" className="border border-slate-200 p-4 text-center text-slate-400 italic">Tidak ada pertanyaan ditemukan.</td></tr>
              ) : (
                questions.map((q, idx) => {
                  const studentAns = attempt.answers?.[q.id] || "";
                  const isCorrect = q.questionType !== "essay" && q.correctAnswer === studentAns;
                  
                  let studentAnsDisplay = studentAns || <span className="text-slate-300 italic">Kosong</span>;
                  let keyDisplay = q.questionType !== "essay" ? q.correctAnswer : <span className="text-slate-400 font-normal">N/A</span>;

                  if (q.questionType === "multiple_choice" && q.options && Array.isArray(q.options)) {
                    const studentAnsIdx = q.options.indexOf(studentAns);
                    if (studentAnsIdx !== -1) {
                      studentAnsDisplay = `(${String.fromCharCode(65 + studentAnsIdx)}) ${studentAns}`;
                    }
                    
                    const keyIdx = q.options.indexOf(q.correctAnswer);
                    if (keyIdx !== -1) {
                      keyDisplay = `(${String.fromCharCode(65 + keyIdx)}) ${q.correctAnswer}`;
                    }
                  }

                  return (
                    <tr key={q.id} className="hover:bg-slate-50/50">
                      <td className="border border-slate-200 p-2.5 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-200 p-2.5">
                        <div className="font-semibold text-slate-900">{q.questionText}</div>
                        {q.questionType === "multiple_choice" && q.options && (
                          <div className="text-[10px] text-slate-400 mt-1 border-t border-slate-100 pt-1">
                            <span className="font-bold">Opsi: </span>{q.options.map((o, i) => `(${String.fromCharCode(65+i)}) ${o}`).join(", ")}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-200 p-2.5 capitalize text-[10px] font-semibold text-slate-500">{q.questionType?.replace("_", " ")}</td>
                      <td className="border border-slate-200 p-2.5 font-bold">{studentAnsDisplay}</td>
                      <td className="border border-slate-200 p-2.5 text-slate-900 font-bold">{keyDisplay}</td>
                      <td className="border border-slate-200 p-2.5 text-center">
                        {q.questionType === "essay" ? (
                          <span className="bg-indigo-100 text-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded">Essay</span>
                        ) : isCorrect ? (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">✓ Benar</span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded">✗ Salah</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Signatures */}
        <div className="flex justify-between mt-12 text-xs pt-8">
          <div className="text-center w-[200px]">
            <div>Siswa Peserta Ujian,</div>
            <div className="h-16"></div>
            <div className="font-bold underline uppercase">{attempt.studentName}</div>
            <div className="text-[10px] text-slate-500">Absen: {attempt.studentNumber || "-"}</div>
          </div>
          <div className="text-center w-[250px]">
            <div>Bekasi, {new Date().toLocaleDateString("id-ID", { dateStyle: "long" })}</div>
            <div className="h-16"></div>
            <div className="font-bold underline uppercase">Pengawas</div>
            <div className="text-[10px] text-slate-500">Mahasiswa UBSI Cibitung</div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-2" />
        <p className="text-gray-500 font-medium">Memuat Laporan...</p>
      </div>
    }>
      <PrintContent />
    </Suspense>
  );
}
