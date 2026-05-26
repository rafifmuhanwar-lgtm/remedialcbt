"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeft, Save, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function CreateExamPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to generate random codes
  const generateCode = (length = 6) => {
    return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
  };
  
  const generateSlug = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  const [formData, setFormData] = useState({
    title: "",
    subject: "",
    className: "",
    durationMinutes: 60,
    startDate: "",
    endDate: "",
    minimumScore: 75,
    status: "active",
    maxAttempts: 1,
    maxViolations: 3,
    examPin: Math.floor(100000 + Math.random() * 900000).toString(), // 6 digit PIN
    examCode: generateCode(),
    examLinkSlug: generateSlug(),
    shuffleQuestions: true,
    shuffleOptions: true,
    antiCheatEnabled: true,
    antiSleepEnabled: true,
    splitScreenDetectionEnabled: true,
    floatingWindowDetectionEnabled: true,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : type === "number" ? Number(value) : value,
    }));
  };

  const refreshCodes = () => {
    setFormData(prev => ({
      ...prev,
      examCode: generateCode(),
      examLinkSlug: generateSlug(),
      examPin: Math.floor(100000 + Math.random() * 900000).toString()
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsSubmitting(true);
    
    try {
      const examData = {
        ...formData,
        teacherId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      
      await addDoc(collection(db, "exams"), examData);
      router.push("/dashboard/exams");
    } catch (error) {
      console.error("Error creating exam:", error);
      alert("Gagal membuat ujian. Silakan coba lagi.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center space-x-4">
        <Link href="/dashboard/exams" className="p-2 rounded-full hover:bg-gray-200 transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buat Ujian Baru</h1>
          <p className="mt-1 text-sm text-gray-500">Isi formulir berikut untuk membuat ujian remedial.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        
        {/* Info Dasar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Informasi Dasar</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Judul Ujian</label>
              <input type="text" name="title" required value={formData.title} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder="Contoh: Remedial Matematika Semester 1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Mata Pelajaran</label>
              <input type="text" name="subject" required value={formData.subject} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder="Contoh: Matematika" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Kelas</label>
              <input type="text" name="className" required value={formData.className} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" placeholder="Contoh: IX A" />
            </div>
          </div>
        </div>

        {/* Akses & Jadwal */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Akses & Jadwal</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Tanggal Mulai</label>
              <input type="datetime-local" name="startDate" required value={formData.startDate} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Tanggal Selesai</label>
              <input type="datetime-local" name="endDate" required value={formData.endDate} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            
            <div className="md:col-span-2 bg-indigo-50 p-4 rounded-lg flex items-center justify-between border border-indigo-100">
              <div className="space-y-1">
                <p className="text-sm font-medium text-indigo-900">Kode & Link Akses (Otomatis)</p>
                <div className="flex flex-col sm:flex-row sm:space-x-4 text-sm text-indigo-700">
                  <p>Kode Ujian: <span className="font-bold font-mono">{formData.examCode}</span></p>
                  <p>PIN Akses: <span className="font-bold font-mono">{formData.examPin}</span></p>
                </div>
                <p className="text-xs text-indigo-500">Link Slug: {formData.examLinkSlug}</p>
              </div>
              <button type="button" onClick={refreshCodes} className="p-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-full transition-colors" title="Generate Ulang">
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Pengaturan Ujian */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-medium text-gray-900">Pengaturan Ujian</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Durasi (Menit)</label>
              <input type="number" min="1" name="durationMinutes" required value={formData.durationMinutes} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">KKM (Nilai Lulus)</label>
              <input type="number" min="0" max="100" name="minimumScore" required value={formData.minimumScore} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Maks. Kesempatan</label>
              <input type="number" min="1" name="maxAttempts" required value={formData.maxAttempts} onChange={handleChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" />
            </div>
          </div>
        </div>

        {/* Sistem Keamanan (Anti-Cheat) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Sistem Keamanan & Anti-Cheat</h2>
            <div className="flex items-center">
              <label className="mr-3 text-sm font-medium text-gray-700">Aktifkan Semua Anti-Cheat</label>
              <input 
                type="checkbox" 
                name="antiCheatEnabled" 
                checked={formData.antiCheatEnabled} 
                onChange={(e) => {
                  const checked = e.target.checked;
                  setFormData(prev => ({
                    ...prev,
                    antiCheatEnabled: checked,
                    antiSleepEnabled: checked,
                    splitScreenDetectionEnabled: checked,
                    floatingWindowDetectionEnabled: checked
                  }));
                }}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" 
              />
            </div>
          </div>
          <div className="p-6 space-y-4">
            
            <div className="flex items-center justify-between py-2">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Batas Pelanggaran (Keluar Layar/Tab)</h4>
                <p className="text-xs text-gray-500">Ujian diblokir otomatis jika melewati batas ini.</p>
              </div>
              <input type="number" min="1" name="maxViolations" value={formData.maxViolations} onChange={handleChange} className="block w-24 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border text-center" />
            </div>
            <hr className="border-gray-100" />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-start space-x-3">
                <input type="checkbox" name="antiSleepEnabled" checked={formData.antiSleepEnabled} onChange={handleChange} disabled={!formData.antiCheatEnabled} className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                <div>
                  <span className="block text-sm font-medium text-gray-700">Anti Sleep Layar (Wake Lock)</span>
                  <span className="block text-xs text-gray-500">Mencegah layar HP mati saat ujian.</span>
                </div>
              </label>

              <label className="flex items-start space-x-3">
                <input type="checkbox" name="splitScreenDetectionEnabled" checked={formData.splitScreenDetectionEnabled} onChange={handleChange} disabled={!formData.antiCheatEnabled} className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                <div>
                  <span className="block text-sm font-medium text-gray-700">Deteksi Split Screen</span>
                  <span className="block text-xs text-gray-500">Memperingatkan jika layar dibagi dua.</span>
                </div>
              </label>

              <label className="flex items-start space-x-3">
                <input type="checkbox" name="floatingWindowDetectionEnabled" checked={formData.floatingWindowDetectionEnabled} onChange={handleChange} disabled={!formData.antiCheatEnabled} className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                <div>
                  <span className="block text-sm font-medium text-gray-700">Deteksi Floating Window</span>
                  <span className="block text-xs text-gray-500">Mendeteksi kemungkinan aplikasi ngambang (pop-up).</span>
                </div>
              </label>

              <label className="flex items-start space-x-3">
                <input type="checkbox" name="shuffleQuestions" checked={formData.shuffleQuestions} onChange={handleChange} className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                <div>
                  <span className="block text-sm font-medium text-gray-700">Acak Soal</span>
                  <span className="block text-xs text-gray-500">Setiap siswa mendapat urutan berbeda.</span>
                </div>
              </label>

              <label className="flex items-start space-x-3">
                <input type="checkbox" name="shuffleOptions" checked={formData.shuffleOptions} onChange={handleChange} className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                <div>
                  <span className="block text-sm font-medium text-gray-700">Acak Opsi Jawaban</span>
                  <span className="block text-xs text-gray-500">Urutan A, B, C, D diacak per siswa.</span>
                </div>
              </label>
            </div>
            
          </div>
        </div>

        {/* Submit */}
        <div className="flex justify-end pt-4">
          <Link href="/dashboard/exams" className="px-6 py-3 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 mr-4">
            Batal
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-70"
          >
            {isSubmitting ? (
              <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Menyimpan...</>
            ) : (
              <><Save className="w-5 h-5 mr-2" /> Simpan Ujian</>
            )}
          </button>
        </div>

      </form>
    </div>
  );
}
