"use client";

import { useEffect, useState, useRef } from "react";
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { AlertCircle, User, Clock, AlertTriangle, MonitorPlay, Activity, Unlock } from "lucide-react";

export default function MonitorPage() {
  const { user, isAdmin } = useAuth();
  const { addNotification } = useNotification();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingExams, setLoadingExams] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  const pollingInterval = useRef(null);
  const prevAttemptsRef = useRef([]);
  const [totalQuestions, setTotalQuestions] = useState(0);

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
          const data = doc.data();
          if (data.status === "active") {
            examsData.push({ id: doc.id, ...data });
          }
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

  const fetchAttempts = async (examId, isPolling = false) => {
    if (!isPolling) setLoading(true);
    try {
      const q = query(collection(db, "studentAttempts"), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      const newAttempts = [];
      querySnapshot.forEach((doc) => {
        newAttempts.push({ id: doc.id, ...doc.data() });
      });
      
      // Check for status changes to trigger notifications
      if (isPolling) {
        newAttempts.forEach(newAtt => {
          const oldAtt = prevAttemptsRef.current.find(a => a.id === newAtt.id);
          if (oldAtt) {
            if (oldAtt.status !== 'blocked' && newAtt.status === 'blocked') {
              addNotification("error", "Peserta Terblokir", `${newAtt.studentName} terblokir karena pelanggaran.`);
            } else if (oldAtt.status !== 'submitted' && newAtt.status === 'submitted') {
              addNotification("success", "Selesai", `${newAtt.studentName} telah selesai mengerjakan.`);
            }
          }
        });
      }
      
      prevAttemptsRef.current = newAttempts;
      setAttempts(newAttempts);
      setLastUpdate(new Date());
    } catch (error) {
      console.error(error);
    } finally {
      if (!isPolling) setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      fetchAttempts(selectedExamId);
      // Fetch total questions for this exam
      getDocs(query(collection(db, "questions"), where("examId", "==", selectedExamId)))
        .then(snap => setTotalQuestions(snap.size))
        .catch(() => {});
      // Polling every 3 seconds
      pollingInterval.current = setInterval(() => {
        fetchAttempts(selectedExamId, true);
      }, 3000);
    } else {
      setAttempts([]);
      setTotalQuestions(0);
    }

    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [selectedExamId]);

  const unblockAttempt = async (attemptId) => {
    if (confirm("Buka blokir untuk peserta ini?")) {
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

  const getViolationCount = (attempt) => {
    if (attempt.violations && Array.isArray(attempt.violations)) {
      return attempt.violations.filter(v => 
        v.isViolation || 
        (v.type && !['wake_lock_enabled', 'wake_lock_released', 'wake_lock_not_supported', 'shortcut_blocked'].includes(v.type))
      ).length;
    }
    return attempt.violationCount || 0;
  };

  const getStatusDisplay = (attempt) => {
    if (attempt.status === 'submitted') {
      return { text: 'Selesai', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' };
    }
    if (attempt.status === 'blocked') {
      return { text: 'Terblokir', color: 'bg-red-100 text-red-700', dot: 'bg-red-500 animate-pulse-dot' };
    }
    if (attempt.status === 'time_expired') {
      return { text: 'Waktu Habis', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' };
    }
    if (attempt.status === 'locked') {
      return { text: 'Terkunci', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500 animate-pulse-dot' };
    }
    
    // In progress - cek lastActiveAt (bisa Firestore Timestamp atau Date string)
    const now = Date.now();
    let lastActive = now;
    if (attempt.lastActiveAt) {
      if (attempt.lastActiveAt.toDate) {
        lastActive = attempt.lastActiveAt.toDate().getTime();
      } else if (attempt.lastActiveAt.seconds) {
        lastActive = attempt.lastActiveAt.seconds * 1000;
      } else {
        lastActive = new Date(attempt.lastActiveAt).getTime();
      }
    }
    const idleSeconds = (now - lastActive) / 1000;
    
    if (idleSeconds > 60) {
      return { text: 'Idle / Tidak Aktif', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' };
    }
    
    return { text: 'Mengerjakan', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500 animate-pulse-dot' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <MonitorPlay className="w-6 h-6 mr-2 text-indigo-600" /> Live Monitor
          </h1>
          <p className="mt-1 text-sm text-gray-500">Pantau ujian yang sedang berlangsung secara real-time.</p>
        </div>
        <div className="text-xs text-gray-500 flex items-center bg-gray-100 px-3 py-1.5 rounded-full">
          <Activity className="w-3 h-3 mr-1.5 text-emerald-500 animate-pulse" />
          Update: {lastUpdate.toLocaleTimeString()}
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Ujian Aktif</label>
        {loadingExams ? (
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-full max-w-md"></div>
        ) : exams.length === 0 ? (
          <div className="text-sm text-amber-600 flex items-center p-3 bg-amber-50 rounded-lg border border-amber-200">
            <AlertCircle className="w-5 h-5 mr-2" />
            Tidak ada ujian yang sedang aktif saat ini.
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
          {loading && attempts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            </div>
          ) : attempts.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <User className="w-12 h-12 mx-auto text-gray-300 mb-2" />
              <p>Belum ada peserta yang online untuk ujian ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peserta</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Progress</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status Real-time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pelanggaran</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {attempts.map(attempt => {
                    const status = getStatusDisplay(attempt);
                    
                    return (
                      <tr key={attempt.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{attempt.studentName}</div>
                          <div className="text-sm text-gray-500">Kls: {attempt.className}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-medium text-gray-900 mr-2">{attempt.answeredCount || 0}{totalQuestions > 0 ? ` / ${totalQuestions}` : ''}</span>
                            <span className="text-xs text-gray-400">soal terjawab</span>
                          </div>
                          {totalQuestions > 0 && (
                            <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1.5">
                              <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, ((attempt.answeredCount || 0) / totalQuestions) * 100)}%` }}></div>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className={`w-2.5 h-2.5 rounded-full mr-2 ${status.dot}`}></div>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.text}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getViolationCount(attempt) > 0 ? (
                            <div className="flex items-center text-red-600">
                              <AlertTriangle className="w-4 h-4 mr-1" />
                              <span className="font-medium">{getViolationCount(attempt)} kali</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {attempt.status === 'blocked' && (
                            <button 
                              onClick={() => unblockAttempt(attempt.id)} 
                              className="inline-flex items-center px-3 py-1.5 border border-indigo-200 rounded-md text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                            >
                              <Unlock className="w-4 h-4 mr-1.5" /> Buka Blokir
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
