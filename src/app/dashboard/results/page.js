"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, updateDoc, doc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { AlertCircle, User, Clock, AlertTriangle, ShieldAlert, CheckCircle, RefreshCcw, Unlock, Download, FileSpreadsheet, FileText } from "lucide-react";
import * as XLSX from "xlsx";

export default function ResultsPage() {
  const { user, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingExams, setLoadingExams] = useState(true);

  useEffect(() => {
    const fetchExams = async () => {
      if (!user) return;
      try {
        const q = isAdmin
          ? query(collection(db, "exams"))
          : query(collection(db, "exams"), where("teacherId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const examsData = [];
        querySnapshot.forEach((doc) => {
          examsData.push({ id: doc.id, ...doc.data() });
        });
        setExams(examsData);
        if (examsData.length > 0) setSelectedExamId(examsData[0].id);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingExams(false);
      }
    };
    fetchExams();
  }, [user, isAdmin]);

  const fetchAttempts = async (examId) => {
    setLoading(true);
    try {
      const q = query(collection(db, "studentAttempts"), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      const aData = [];
      querySnapshot.forEach((doc) => {
        aData.push({ id: doc.id, ...doc.data() });
      });
      setAttempts(aData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      fetchAttempts(selectedExamId);
    } else {
      setAttempts([]);
    }
  }, [selectedExamId]);

  const unblockAttempt = async (attemptId) => {
    if (confirm("Buka blokir untuk peserta ini? Status akan dikembalikan ke in_progress.")) {
      try {
        await updateDoc(doc(db, "studentAttempts", attemptId), {
          status: "in_progress",
          violationCount: 0
        });
        fetchAttempts(selectedExamId);
        addNotification("success", "Berhasil", "Blokir peserta telah dibuka.");
      } catch (error) {
        console.error(error);
        addNotification("error", "Gagal", "Tidak dapat membuka blokir.");
      }
    }
  };

  const resetAttempt = async (attemptId) => {
    if (confirm("Reset attempt ini? Semua data pengerjaan peserta untuk sesi ini akan dihapus.")) {
      try {
        await deleteDoc(doc(db, "studentAttempts", attemptId));
        fetchAttempts(selectedExamId);
        addNotification("success", "Berhasil", "Attempt peserta telah direset.");
      } catch (error) {
        console.error(error);
        addNotification("error", "Gagal", "Tidak dapat mereset attempt.");
      }
    }
  };

  // ====== EXPORT FUNCTIONS ======
  const getSelectedExam = () => exams.find(e => e.id === selectedExamId);

  const getExportData = () => {
    const exam = getSelectedExam();
    return attempts.map((a, idx) => ({
      "No": idx + 1,
      "Nama Siswa": a.studentName || "-",
      "Kelas": a.className || "-",
      "No Absen": a.studentNumber || "-",
      "Nilai": a.score || 0,
      "Status": a.status === "submitted" ? "Selesai" :
        a.status === "time_expired" ? "Waktu Habis" :
          a.status === "blocked" ? "Diblokir" :
            a.status === "locked" ? "Terkunci" : "Berjalan",
      "Keterangan": (a.score || 0) >= (exam?.minimumScore || 75) ? "LULUS" : "BELUM LULUS",
      "Pelanggaran": a.violationCount || 0,
    }));
  };

  const exportToExcel = () => {
    const data = getExportData();
    if (data.length === 0) {
      addNotification("warning", "Data Kosong", "Tidak ada data peserta untuk diexport.");
      return;
    }
    const exam = getSelectedExam();
    const ws = XLSX.utils.json_to_sheet(data);

    // Set column widths
    ws['!cols'] = [
      { wch: 4 },  // No
      { wch: 25 }, // Nama
      { wch: 8 },  // Kelas
      { wch: 10 }, // No Absen
      { wch: 8 },  // Nilai
      { wch: 14 }, // Status
      { wch: 14 }, // Keterangan
      { wch: 12 }, // Pelanggaran
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hasil Ujian");

    const date = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
    const filename = `Hasil_${(exam?.title || "Ujian").replace(/\s+/g, "_")}_${date}.xlsx`;
    XLSX.writeFile(wb, filename);
    addNotification("success", "Export Berhasil", `File ${filename} telah diunduh.`);
  };

  const exportToCSV = () => {
    const data = getExportData();
    if (data.length === 0) {
      addNotification("warning", "Data Kosong", "Tidak ada data peserta untuk diexport.");
      return;
    }
    const exam = getSelectedExam();
    const ws = XLSX.utils.json_to_sheet(data);
    const csv = XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toLocaleDateString("id-ID").replace(/\//g, "-");
    a.href = url;
    a.download = `Hasil_${(exam?.title || "Ujian").replace(/\s+/g, "_")}_${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addNotification("success", "Export Berhasil", "File CSV telah diunduh.");
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted': return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Selesai</span>;
      case 'time_expired': return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Waktu Habis</span>;
      case 'blocked': return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Diblokir</span>;
      case 'locked': return <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full">Terkunci</span>;
      default: return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Berjalan</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hasil & Log Peserta</h1>
        <p className="mt-1 text-sm text-gray-500">Pantau nilai dan aktivitas peserta saat ujian.</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Ujian</label>
        {loadingExams ? (
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-full max-w-md"></div>
        ) : exams.length === 0 ? (
          <div className="text-sm text-red-500 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            Anda belum memiliki ujian.
          </div>
        ) : (
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="block w-full max-w-md rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
          >
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>{ex.title} ({ex.className})</option>
            ))}
          </select>
        )}
      </div>

      {selectedExamId && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-lg font-medium text-gray-900">Daftar Peserta</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => fetchAttempts(selectedExamId)} className="text-sm text-indigo-600 hover:text-indigo-900 flex items-center px-3 py-1.5 border border-indigo-200 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition-colors">
                <RefreshCcw className="w-4 h-4 mr-1" /> Refresh
              </button>
              <button onClick={exportToExcel} className="text-sm text-emerald-600 hover:text-emerald-900 flex items-center px-3 py-1.5 border border-emerald-200 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors">
                <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
              </button>
              <button onClick={exportToCSV} className="text-sm text-blue-600 hover:text-blue-900 flex items-center px-3 py-1.5 border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
                <FileText className="w-4 h-4 mr-1" /> CSV
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : attempts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <User className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>Belum ada peserta yang mengikuti ujian ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peserta</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nilai</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggaran</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attempts.map(attempt => (
                    <tr key={attempt.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{attempt.studentName}</div>
                        <div className="text-sm text-gray-500">No: {attempt.studentNumber} | Kls: {attempt.className}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-xl font-bold text-gray-900">{attempt.score || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(attempt.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {attempt.violationCount > 0 ? (
                            <><AlertTriangle className="w-4 h-4 text-orange-500 mr-1" /> <span className="text-orange-600 font-medium">{attempt.violationCount} kali</span></>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        {attempt.status === 'blocked' && (
                          <button onClick={() => unblockAttempt(attempt.id)} className="text-indigo-600 hover:text-indigo-900 border border-indigo-200 rounded px-2 py-1 bg-indigo-50" title="Buka Blokir">
                            <Unlock className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => resetAttempt(attempt.id)} className="text-red-600 hover:text-red-900 border border-red-200 rounded px-2 py-1 bg-red-50" title="Reset Ujian">
                          <RefreshCcw className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
