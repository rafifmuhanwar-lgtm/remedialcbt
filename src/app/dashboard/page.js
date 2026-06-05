"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  FileText, 
  Users, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Ban,
  ListChecks,
  Monitor
} from "lucide-react";
import Link from "next/link";
import DashboardCharts from "@/components/dashboard/DashboardCharts";

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalExams: 0,
    activeExams: 0,
    totalParticipants: 0,
    passedParticipants: 0,
    failedParticipants: 0,
    totalViolations: 0,
    blockedParticipants: 0,
  });
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState([]);
  const [exams, setExams] = useState([]);

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      try {
        // Fetch exams
        const examsRef = collection(db, "exams");
        const qExams = isAdmin 
          ? query(examsRef) 
          : query(examsRef, where("teacherId", "==", user.uid));
        const examDocs = await getDocs(qExams);
        
        let active = 0;
        let examIds = [];
        let examsData = [];
        examDocs.forEach((doc) => {
          const data = doc.data();
          examIds.push(doc.id);
          examsData.push({ id: doc.id, ...data });
          if (data.status === "active") active++;
        });

        setExams(examsData);

        // Fetch all attempts
        let allAttempts = [];
        const attemptsRef = collection(db, "studentAttempts");
        const attemptsSnap = await getDocs(query(attemptsRef));
        attemptsSnap.forEach((doc) => {
          const data = doc.data();
          if (examIds.includes(data.examId)) {
            allAttempts.push({ id: doc.id, ...data });
          }
        });

        setAttempts(allAttempts);

        // Calculate stats from attempts
        let passed = 0, failed = 0, violations = 0, blocked = 0;
        allAttempts.forEach((a) => {
          const exam = examsData.find(e => e.id === a.examId);
          const kkm = exam?.minimumScore || 75;
          if (a.status === "submitted" || a.status === "time_expired") {
            if ((a.score || 0) >= kkm) passed++;
            else failed++;
          }
          
          let aViolationCount = 0;
          if (a.violations && Array.isArray(a.violations)) {
            aViolationCount = a.violations.filter(v => 
              v.isViolation || 
              (v.type && !['wake_lock_enabled', 'wake_lock_released', 'wake_lock_not_supported', 'shortcut_blocked'].includes(v.type))
            ).length;
          } else if (a.violationCount) {
            aViolationCount = a.violationCount;
          }
          violations += aViolationCount;

          if (a.status === "blocked") blocked++;
        });

        setStats({
          totalExams: examDocs.size,
          activeExams: active,
          totalParticipants: allAttempts.length,
          passedParticipants: passed,
          failedParticipants: failed,
          totalViolations: violations,
          blockedParticipants: blocked,
        });

      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, isAdmin]);

  const statCards = [
    { name: "Total Ujian", value: stats.totalExams, icon: FileText, color: "bg-blue-500" },
    { name: "Ujian Aktif", value: stats.activeExams, icon: CheckCircle, color: "bg-green-500" },
    { name: "Total Peserta", value: stats.totalParticipants, icon: Users, color: "bg-indigo-500" },
    { name: "Lulus", value: stats.passedParticipants, icon: CheckCircle, color: "bg-emerald-500" },
    { name: "Belum Lulus", value: stats.failedParticipants, icon: XCircle, color: "bg-red-500" },
    { name: "Total Pelanggaran", value: stats.totalViolations, icon: AlertTriangle, color: "bg-orange-500" },
    { name: "Diblokir", value: stats.blockedParticipants, icon: Ban, color: "bg-rose-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ringkasan aktivitas ujian remedial Anda.
          {isAdmin && <span className="ml-1 text-indigo-600 font-medium">(Mode Admin)</span>}
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {statCards.map((item) => (
              <div key={item.name} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500 truncate pr-2">{item.name}</span>
                  <div className={`p-2 rounded-lg ${item.color} bg-opacity-10`}>
                    <item.icon className={`w-5 h-5 ${item.color.replace('bg-', 'text-')}`} />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">{item.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Charts Section */}
          <DashboardCharts attempts={attempts} exams={exams} />
        </>
      )}

      <div className="mt-8 pt-8 border-t border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Aksi Cepat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link href="/dashboard/exams" className="flex items-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all">
            <div className="p-3 bg-indigo-50 rounded-lg mr-4">
              <FileText className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Buat Ujian</h3>
              <p className="text-sm text-gray-500">Tambah ujian baru</p>
            </div>
          </Link>
          <Link href="/dashboard/questions" className="flex items-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all">
            <div className="p-3 bg-blue-50 rounded-lg mr-4">
              <ListChecks className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Kelola Soal</h3>
              <p className="text-sm text-gray-500">Tambah / edit bank soal</p>
            </div>
          </Link>
          <Link href="/dashboard/results" className="flex items-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all">
            <div className="p-3 bg-emerald-50 rounded-lg mr-4">
              <Users className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Lihat Hasil</h3>
              <p className="text-sm text-gray-500">Pantau nilai peserta</p>
            </div>
          </Link>
          <Link href="/dashboard/monitor" className="flex items-center p-4 bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-500 hover:ring-1 hover:ring-indigo-500 transition-all">
            <div className="p-3 bg-violet-50 rounded-lg mr-4">
              <Monitor className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Live Monitor</h3>
              <p className="text-sm text-gray-500">Pantau ujian real-time</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
