"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShieldAlert, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";

export default function InstruksiUjianPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  const [sessionData, setSessionData] = useState(null);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [existingAttempt, setExistingAttempt] = useState(null);

  useEffect(() => {
    // 1. Ambil data sesi lokal
    const fetchInitData = async () => {
      try {
        let storedSession = null;
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('exam_session_')) {
            storedSession = JSON.parse(sessionStorage.getItem(key));
            break;
          }
        }

        if (!storedSession) {
          router.replace(`/ujian/${slug}`);
          return;
        }

        setSessionData(storedSession);

        // 2. Fetch data ujian
        const examDocRef = doc(db, "exams", storedSession.examId);
        const examSnap = await getDoc(examDocRef);

        if (!examSnap.exists()) {
          setError("Data ujian tidak ditemukan.");
          setLoading(false);
          return;
        }

        const examData = { id: examSnap.id, ...examSnap.data() };
        setExam(examData);

        // 3. Cek attempt sebelumnya
        const attemptQ = query(
          collection(db, "studentAttempts"),
          where("examId", "==", examData.id),
          where("studentName", "==", storedSession.studentName),
          where("studentNumber", "==", storedSession.studentNumber)
        );

        const attemptSnap = await getDocs(attemptQ);
        if (!attemptSnap.empty) {
          // Cari apakah ada yang statusnya 'in_progress' atau 'locked'
          const activeAttemptDoc = attemptSnap.docs.find(d => {
            const status = d.data().status;
            return status === 'in_progress' || status === 'locked';
          });

          if (activeAttemptDoc) {
            setExistingAttempt({ id: activeAttemptDoc.id, ...activeAttemptDoc.data() });
          } else {
            // Jika tidak ada yang aktif, cek apakah sudah melebihi batas maksimal pengerjaan
            const attempt = attemptSnap.docs[0].data();
            if (attempt.status === 'blocked') {
              setError("Akses ditolak. Ujian Anda telah diblokir. Hubungi guru pengawas.");
            } else if (attempt.status === 'submitted' || attempt.status === 'time_expired') {
              if (examData.maxAttempts && attemptSnap.size >= examData.maxAttempts) {
                setError(`Akses ditolak. Anda telah mencapai batas maksimal pengerjaan (${examData.maxAttempts} kali).`);
              }
            }
          }
        }

      } catch (err) {
        console.error(err);
        setError("Terjadi kesalahan.");
      } finally {
        setLoading(false);
      }
    };

    fetchInitData();
  }, [slug, router]);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const startExam = async () => {
    if (!exam || !sessionData) return;
    setIsStarting(true);

    try {
      const deviceId = localStorage.getItem('deviceId') || generateId();
      localStorage.setItem('deviceId', deviceId);
      const sessionId = generateId();

      let attemptId;

      if (existingAttempt) {
        // Lanjutkan attempt yang sudah ada (0 write ke Firestore)
        attemptId = existingAttempt.id;
        
        // Simpan attempt ID ke localStorage & sessionStorage
        localStorage.setItem(`exam_attempt_id_${exam.id}`, attemptId);

        sessionStorage.setItem(`attempt_${exam.id}`, JSON.stringify({
          attemptId: attemptId,
          sessionId: existingAttempt.sessionId || sessionId,
          deviceId: existingAttempt.deviceId || deviceId
        }));
      } else {
        // Buat attempt baru (1 write ke Firestore)
        const attemptData = {
          examId: exam.id,
          examCode: exam.examCode,
          studentName: sessionData.studentName,
          className: sessionData.className,
          studentNumber: sessionData.studentNumber,
          deviceId,
          sessionId,
          startedAt: serverTimestamp(),
          score: 0,
          status: "in_progress",
          violationCount: 0,
          initialWidth: window.innerWidth,
          initialHeight: window.innerHeight,
          screenWidth: window.screen.width,
          screenHeight: window.screen.height,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "studentAttempts"), attemptData);
        attemptId = docRef.id;

        // Simpan attempt ID ke localStorage & sessionStorage
        localStorage.setItem(`exam_attempt_id_${exam.id}`, attemptId);

        sessionStorage.setItem(`attempt_${exam.id}`, JSON.stringify({
          attemptId: attemptId,
          sessionId,
          deviceId
        }));
      }

      // Redirect ke kerjakan page
      router.push(`/ujian/${slug}/kerjakan`);

    } catch (err) {
      console.error(err);
      alert("Gagal memulai ujian. Error: " + err.message);
      setIsStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-6 rounded-2xl shadow-md border border-red-100 max-w-md w-full text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => router.replace(`/ujian/${slug}`)}
            className="w-full py-2 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg transition-colors"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-2xl w-full overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white">
          <h1 className="text-2xl font-bold">{exam?.title}</h1>
          <p className="text-indigo-100 text-sm mt-1">{exam?.subject} • Kelas {exam?.className}</p>
        </div>

        {/* Info */}
        <div className="p-6 border-b border-gray-200 bg-gray-50 grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <span className="block text-gray-400">Nama Siswa</span>
            <span className="font-semibold text-gray-900">{sessionData?.studentName}</span>
          </div>
          <div>
            <span className="block text-gray-400">No Absen</span>
            <span className="font-semibold text-gray-900">{sessionData?.studentNumber}</span>
          </div>
          <div>
            <span className="block text-gray-400">Durasi Ujian</span>
            <span className="font-semibold text-gray-900">{exam?.durationMinutes} Menit</span>
          </div>
          <div>
            <span className="block text-gray-400">KKM</span>
            <span className="font-semibold text-gray-900">{exam?.minimumScore || 75}</span>
          </div>
        </div>

        {/* Peraturan */}
        <div className="p-6 space-y-4">
          <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
            <h3 className="text-sm font-bold text-yellow-800 flex items-center mb-2">
              <ShieldAlert className="w-5 h-5 mr-2" />
              Perhatian & Tata Tertib Ujian
            </h3>
            <ul className="space-y-2 text-sm text-yellow-800">
              <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-yellow-600" /> Jangan keluar dari halaman ujian.</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-yellow-600" /> Jangan pindah tab, membuka aplikasi lain, atau menggunakan split screen.</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-yellow-600" /> Jika layar mati atau aplikasi tertutup, ujian akan terblokir.</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-yellow-600" /> Jika terblokir, segera laporkan kepada Pengawas.</li>
              <li className="flex items-start"><CheckCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0 text-yellow-600" /> Semua tindakan curang akan menyebabkan ujian DIBLOKIR.</li>
            </ul>
          </div>          <div className="p-6 bg-gray-50 rounded-xl">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <input id="agree" type="checkbox" required className="h-5 w-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="agree" className="font-medium text-gray-900">Saya Mengerti dan Setuju</label>
                <p className="text-gray-500">Saya telah membaca tata tertib dan setuju untuk mengerjakan ujian secara jujur.</p>
              </div>
            </div>

            <button
              onClick={() => {
                if (!document.getElementById('agree').checked) {
                  alert("Anda harus menyetujui tata tertib ujian terlebih dahulu.");
                  return;
                }
                startExam();
              }}
              disabled={isStarting}
              className="mt-6 w-full flex justify-center py-4 px-4 border border-transparent rounded-xl shadow-md text-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all"
            >
              {isStarting ? (
                <><Loader2 className="w-6 h-6 mr-2 animate-spin" /> Mempersiapkan Ujian...</>
              ) : existingAttempt ? (
                "Lanjutkan Ujian Sekarang"
              ) : (
                "Mulai Ujian Sekarang"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
