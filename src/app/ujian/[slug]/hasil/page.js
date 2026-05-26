"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookOpenCheck, CheckCircle, XCircle, ShieldAlert, Loader2 } from "lucide-react";

export default function HasilUjianPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;
  const [attempt, setAttempt] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        let attemptInfo = null;
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key?.startsWith("attempt_")) {
            attemptInfo = JSON.parse(sessionStorage.getItem(key));
            break;
          }
        }
        if (!attemptInfo) { router.replace(`/ujian/${slug}`); return; }

        const attemptSnap = await getDoc(doc(db, "studentAttempts", attemptInfo.attemptId));
        if (!attemptSnap.exists()) { router.replace(`/ujian/${slug}`); return; }
        const attemptData = { id: attemptSnap.id, ...attemptSnap.data() };
        setAttempt(attemptData);

        const examSnap = await getDoc(doc(db, "exams", attemptData.examId));
        if (examSnap.exists()) setExam({ id: examSnap.id, ...examSnap.data() });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [slug, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!attempt || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-gray-500">Data tidak ditemukan.</p>
      </div>
    );
  }

  const isPassed = attempt.score >= (exam.minimumScore || 75);
  const isBlockedStatus = attempt.status === "blocked";
  const isFinished = attempt.status === "submitted" || attempt.status === "time_expired";

  const getHeaderColor = () => {
    if (isBlockedStatus) return "bg-red-600";
    if (!isFinished) return "bg-blue-600";
    return isPassed ? "bg-green-600" : "bg-orange-500";
  };
  const getHeaderText = () => {
    if (isBlockedStatus) return "DIBLOKIR";
    if (!isFinished) return "UJIAN BERJALAN";
    return isPassed ? "LULUS" : "BELUM LULUS";
  };
  const getHeaderDesc = () => {
    if (isBlockedStatus) return "Ujian diblokir karena pelanggaran.";
    if (!isFinished) return "Ujian Anda masih berlangsung.";
    return isPassed ? "Selamat! Anda memenuhi KKM." : "Anda belum memenuhi KKM.";
  };
  const getHeaderIcon = () => {
    if (isBlockedStatus) return <ShieldAlert className="w-10 h-10 text-white" />;
    if (!isFinished) return <BookOpenCheck className="w-10 h-10 text-white" />;
    return isPassed ? <CheckCircle className="w-10 h-10 text-white" /> : <XCircle className="w-10 h-10 text-white" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className={`p-8 text-center ${getHeaderColor()}`}>
          <div className="bg-white/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            {getHeaderIcon()}
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-1">
            {getHeaderText()}
          </h1>
          <p className="text-white/80 text-sm">
            {getHeaderDesc()}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="text-center">
            <p className="text-5xl font-extrabold text-gray-900">{attempt.score || 0}</p>
            <p className="text-sm text-gray-500 mt-1">Nilai Akhir (KKM: {exam.minimumScore})</p>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Nama</span>
              <span className="font-medium text-gray-900">{attempt.studentName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Ujian</span>
              <span className="font-medium text-gray-900">{exam.title}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Kelas</span>
              <span className="font-medium text-gray-900">{attempt.className}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Status Pengerjaan</span>
              <span className={`font-medium ${
                attempt.status === "submitted" ? "text-green-600" : 
                attempt.status === "time_expired" ? "text-yellow-600" : 
                attempt.status === "blocked" ? "text-red-600" :
                attempt.status === "locked" ? "text-orange-600" :
                "text-blue-600"
              }`}>
                {attempt.status === "submitted" ? "Selesai" : 
                 attempt.status === "time_expired" ? "Waktu Habis" : 
                 attempt.status === "blocked" ? "Diblokir" :
                 attempt.status === "locked" ? "Terkunci" :
                 "Sedang Berjalan"}
              </span>
            </div>
            {attempt.violationCount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Pelanggaran</span>
                <span className="font-medium text-orange-600">{attempt.violationCount} kali</span>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-500 border border-gray-100">
            Ujian telah Selesai Silahkan Hubungi Guru untuk Informasi Lebih Lanjut.
          </div>
        </div>
      </div>
    </div>
  );
}
