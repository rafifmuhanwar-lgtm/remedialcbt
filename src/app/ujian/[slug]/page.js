"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BookOpenCheck, ArrowRight, Loader2, AlertCircle } from "lucide-react";

export default function UjianEntryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    studentName: "",
    className: "",
    studentNumber: "",
    examCode: ""
  });

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const q = query(collection(db, "exams"), where("examLinkSlug", "==", slug));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          setError("Ujian tidak ditemukan. Periksa kembali link ujian Anda.");
          setLoading(false);
          return;
        }

        const examDoc = querySnapshot.docs[0];
        const examData = { id: examDoc.id, ...examDoc.data() };

        if (examData.status !== "active") {
          setError("Ujian ini sedang tidak aktif.");
        } else {
          setExam(examData);
        }
      } catch (err) {
        console.error(err);
        setError("Terjadi kesalahan saat memuat data ujian.");
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchExam();
    }
  }, [slug]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!exam) return;
    setIsSubmitting(true);
    setError("");

    // Validasi kode ujian
    if (formData.examCode.toUpperCase() !== exam.examCode) {
      setError("Kode ujian salah. Silakan minta kode ujian yang benar dari guru Anda.");
      setIsSubmitting(false);
      return;
    }

    // Cek jadwal ujian jika ada (opsional, tapi disarankan)
    const now = new Date().getTime();
    const startDate = new Date(exam.startDate).getTime();
    const endDate = new Date(exam.endDate).getTime();

    if (now < startDate) {
      setError("Ujian belum dimulai.");
      setIsSubmitting(false);
      return;
    }

    if (now > endDate) {
      setError("Jadwal ujian telah berakhir.");
      setIsSubmitting(false);
      return;
    }

    // Jika valid, simpan data sesi lokal sementara
    const sessionData = {
      studentName: formData.studentName,
      className: formData.className,
      studentNumber: formData.studentNumber,
      examId: exam.id,
      examCode: exam.examCode
    };
    
    sessionStorage.setItem(`exam_session_${exam.id}`, JSON.stringify(sessionData));
    
    // Pindah ke halaman instruksi
    router.push(`/ujian/${slug}/instruksi`);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-md">
            <BookOpenCheck className="w-10 h-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          RemedialCBT
        </h2>
        {exam ? (
          <p className="mt-2 text-center text-sm text-gray-600 font-medium px-4">
            Ujian: {exam.title} <br />
            <span className="text-gray-500 font-normal">{exam.subject} - {exam.className}</span>
          </p>
        ) : (
          <p className="mt-2 text-center text-sm text-gray-600 font-medium">Akses Ujian Remedial</p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-gray-100">
          {error ? (
            <div className="rounded-md bg-red-50 p-4 mb-6 border border-red-200">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Akses Ditolak</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {exam && !error && (
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
                <div className="mt-1">
                  <input type="text" name="studentName" required value={formData.studentName} onChange={handleChange} className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" placeholder="Masukkan nama lengkap Anda" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Kelas</label>
                  <div className="mt-1">
                    <input type="text" name="className" required value={formData.className} onChange={handleChange} className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" placeholder="Contoh: 9A" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">No Absen</label>
                  <div className="mt-1">
                    <input type="number" name="studentNumber" required min="1" value={formData.studentNumber} onChange={handleChange} className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors" placeholder="Contoh: 15" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Kode Ujian</label>
                <div className="mt-1">
                  <input type="text" name="examCode" required value={formData.examCode} onChange={handleChange} style={{textTransform: 'uppercase'}} className="appearance-none block w-full px-3 py-3 border border-gray-300 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm font-mono tracking-widest text-center text-lg transition-colors" placeholder="KODE" />
                </div>
              </div>

              <div>
                <button type="submit" disabled={isSubmitting} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70 transition-all">
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>Lanjutkan <ArrowRight className="ml-2 w-5 h-5" /></>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
