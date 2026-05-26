"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import Link from "next/link";
import { Plus, Edit, Trash2, Copy, Eye, EyeOff, CheckCircle2, PlayCircle, PauseCircle, CopyPlus } from "lucide-react";

export default function ExamsPage() {
  const { user, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchExams = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = isAdmin
        ? query(collection(db, "exams"))
        : query(collection(db, "exams"), where("teacherId", "==", user.uid));
      const querySnapshot = await getDocs(q);
      const examsData = [];
      querySnapshot.forEach((doc) => {
        examsData.push({ id: doc.id, ...doc.data() });
      });
      // Sort by creation date if needed, for now just set
      setExams(examsData);
    } catch (error) {
      console.error("Error fetching exams:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, [user, isAdmin]);

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "exams", id), { status: newStatus });
      fetchExams();
      addNotification("success", "Status Diperbarui", `Ujian sekarang ${newStatus === 'active' ? 'Aktif' : 'Nonaktif'}.`);
    } catch (error) {
      console.error("Error updating status:", error);
      addNotification("error", "Gagal", "Tidak dapat memperbarui status ujian.");
    }
  };

  const deleteExam = async (id) => {
    if (confirm("Apakah Anda yakin ingin menghapus ujian ini? Data soal dan hasil akan terpengaruh.")) {
      try {
        await deleteDoc(doc(db, "exams", id));
        fetchExams();
        addNotification("success", "Berhasil", "Ujian telah dihapus.");
      } catch (error) {
        console.error("Error deleting exam:", error);
        addNotification("error", "Gagal", "Tidak dapat menghapus ujian.");
      }
    }
  };

  const generateCode = (length = 6) => {
    return Math.random().toString(36).substring(2, 2 + length).toUpperCase();
  };
  
  const generateSlug = () => {
    return Math.random().toString(36).substring(2, 10);
  };

  const duplicateExam = async (exam) => {
    if (confirm("Duplikat ujian ini? Ujian dan semua soalnya akan disalin.")) {
      try {
        const newExam = {
          ...exam,
          title: `[Copy] ${exam.title}`,
          status: "inactive",
          examCode: generateCode(),
          examLinkSlug: generateSlug(),
          examPin: Math.floor(100000 + Math.random() * 900000).toString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        delete newExam.id;

        const newExamRef = await addDoc(collection(db, "exams"), newExam);

        // Duplicate questions
        const qDocs = await getDocs(query(collection(db, "questions"), where("examId", "==", exam.id)));
        const questions = [];
        qDocs.forEach(d => questions.push(d.data()));

        for (const q of questions) {
          const newQ = { ...q, examId: newExamRef.id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
          await addDoc(collection(db, "questions"), newQ);
        }

        fetchExams();
        addNotification("success", "Berhasil", "Ujian berhasil diduplikat.");
      } catch (error) {
        console.error("Error duplicating exam:", error);
        addNotification("error", "Gagal", "Tidak dapat menduplikat ujian.");
      }
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    addNotification("info", "Disalin", "Teks berhasil disalin ke clipboard.", 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manajemen Ujian</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola ujian remedial Anda di sini.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Link
            href="/dashboard/exams/create"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            Buat Ujian
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Memuat data...</p>
        </div>
      ) : exams.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada ujian</h3>
          <p className="mt-1 text-sm text-gray-500">Mulai buat ujian remedial pertama Anda.</p>
          <div className="mt-6">
            <Link
              href="/dashboard/exams/create"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              Buat Ujian Baru
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Info Ujian</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Akses (Link & Kode)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exams.map((exam) => (
                  <tr key={exam.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900">{exam.title}</span>
                        <span className="text-sm text-gray-500">{exam.subject} - {exam.className}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center text-sm text-gray-900">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded mr-2">{exam.examCode}</span>
                          <button onClick={() => copyToClipboard(exam.examCode)} className="text-gray-400 hover:text-indigo-600" title="Copy Kode">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <span className="truncate w-32 mr-2">/ujian/{exam.examLinkSlug}</span>
                          <button onClick={() => copyToClipboard(`${window.location.origin}/ujian/${exam.examLinkSlug}`)} className="text-gray-400 hover:text-indigo-600" title="Copy Link">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleStatus(exam.id, exam.status)}
                        className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium ${
                          exam.status === "active" 
                            ? "bg-green-100 text-green-800 hover:bg-green-200" 
                            : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                        }`}
                      >
                        {exam.status === "active" ? (
                          <><PlayCircle className="w-3 h-3 mr-1" /> Aktif</>
                        ) : (
                          <><PauseCircle className="w-3 h-3 mr-1" /> Nonaktif</>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-3">
                        <button onClick={() => duplicateExam(exam)} className="text-blue-600 hover:text-blue-900" title="Duplikat Ujian">
                          <CopyPlus className="h-5 w-5" />
                        </button>
                        <Link href={`/dashboard/exams/${exam.id}/edit`} className="text-indigo-600 hover:text-indigo-900" title="Edit Ujian">
                          <Edit className="h-5 w-5" />
                        </Link>
                        <button onClick={() => deleteExam(exam.id)} className="text-red-600 hover:text-red-900" title="Hapus Ujian">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
