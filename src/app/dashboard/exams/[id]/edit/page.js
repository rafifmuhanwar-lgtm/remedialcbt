"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Save, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function EditExamPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const examId = params?.id;
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const examSnap = await getDoc(doc(db, "exams", examId));
        if (!examSnap.exists()) { router.push("/dashboard/exams"); return; }
        const data = examSnap.data();
        if (data.teacherId !== user?.uid) { router.push("/dashboard/exams"); return; }
        setFormData(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (user && examId) fetchExam();
  }, [user, examId, router]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "exams", examId), { ...formData, updatedAt: serverTimestamp() });
      router.push("/dashboard/exams");
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan perubahan.");
      setIsSubmitting(false);
    }
  };

  if (loading || !formData) {
    return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard/exams" className="p-2 rounded-full hover:bg-gray-200 transition-colors"><ArrowLeft className="w-6 h-6 text-gray-600" /></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Ujian</h1>
          <p className="mt-1 text-sm text-gray-500">Ubah pengaturan ujian.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Info Dasar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50"><h2 className="text-lg font-medium text-gray-900">Informasi Dasar</h2></div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Judul Ujian</label>
              <input type="text" name="title" required value={formData.title} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mata Pelajaran</label>
              <input type="text" name="subject" required value={formData.subject} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Kelas</label>
              <input type="text" name="className" required value={formData.className} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
          </div>
        </div>

        {/* Jadwal */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50"><h2 className="text-lg font-medium text-gray-900">Jadwal & Akses</h2></div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tanggal Mulai</label>
              <input type="datetime-local" name="startDate" required value={formData.startDate} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tanggal Selesai</label>
              <input type="datetime-local" name="endDate" required value={formData.endDate} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div className="md:col-span-2 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
              <div className="flex flex-col sm:flex-row sm:space-x-6 text-sm text-indigo-700">
                <p>Kode: <span className="font-bold font-mono">{formData.examCode}</span></p>
                <p>PIN: <span className="font-bold font-mono">{formData.examPin}</span></p>
                <p>Slug: <span className="font-mono text-xs">{formData.examLinkSlug}</span></p>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">PIN Ujian</label>
              <input type="text" name="examPin" required value={formData.examPin} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border font-mono" />
            </div>
          </div>
        </div>

        {/* Pengaturan */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50"><h2 className="text-lg font-medium text-gray-900">Pengaturan Ujian</h2></div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Durasi (Menit)</label>
              <input type="number" min="1" name="durationMinutes" value={formData.durationMinutes} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">KKM</label>
              <input type="number" min="0" max="100" name="minimumScore" value={formData.minimumScore} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Maks. Pelanggaran</label>
              <input type="number" min="1" name="maxViolations" value={formData.maxViolations} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
          </div>
          <div className="p-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: "antiCheatEnabled", label: "Anti-Cheat Mode" },
              { name: "antiSleepEnabled", label: "Anti Sleep Layar" },
              { name: "splitScreenDetectionEnabled", label: "Deteksi Split Screen" },
              { name: "floatingWindowDetectionEnabled", label: "Deteksi Floating Window" },
              { name: "shuffleQuestions", label: "Acak Soal" },
              { name: "shuffleOptions", label: "Acak Opsi Jawaban" },
            ].map(opt => (
              <label key={opt.name} className="flex items-center space-x-3">
                <input type="checkbox" name={opt.name} checked={formData[opt.name] || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                <span className="text-sm font-medium text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end space-x-4 pt-4">
          <Link href="/dashboard/exams" className="px-6 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50">Batal</Link>
          <button type="submit" disabled={isSubmitting} className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70">
            {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Menyimpan...</> : <><Save className="w-5 h-5 mr-2" /> Simpan Perubahan</>}
          </button>
        </div>
      </form>
    </div>
  );
}
