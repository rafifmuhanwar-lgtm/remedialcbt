"use client";

import { useMemo } from "react";

// ====== DONUT CHART ======
function DonutChart({ passed, failed, total }) {
  const passedPct = total > 0 ? (passed / total) * 100 : 0;
  const failedPct = total > 0 ? (failed / total) * 100 : 0;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const passedOffset = circumference - (passedPct / 100) * circumference;
  const failedArcStart = (passedPct / 100) * circumference;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Rasio Kelulusan</h3>
      {total === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          Belum ada data peserta
        </div>
      ) : (
        <div className="flex items-center justify-center gap-6">
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              {/* Background circle */}
              <circle cx="60" cy="60" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="12" />
              {/* Passed arc (green) */}
              <circle
                cx="60" cy="60" r={radius} fill="none"
                stroke="#10b981" strokeWidth="12"
                strokeDasharray={circumference}
                strokeDashoffset={passedOffset}
                strokeLinecap="round"
                className="animate-draw-donut"
              />
              {/* Failed arc (red) */}
              {failedPct > 0 && (
                <circle
                  cx="60" cy="60" r={radius} fill="none"
                  stroke="#ef4444" strokeWidth="12"
                  strokeDasharray={`${(failedPct / 100) * circumference} ${circumference}`}
                  strokeDashoffset={-failedArcStart}
                  strokeLinecap="round"
                  className="animate-draw-donut"
                />
              )}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-gray-900">{Math.round(passedPct)}%</span>
              <span className="text-xs text-gray-500">Lulus</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Lulus: <span className="font-semibold text-gray-900">{passed}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-sm text-gray-600">Belum Lulus: <span className="font-semibold text-gray-900">{failed}</span></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
              <span className="text-sm text-gray-600">Total: <span className="font-semibold text-gray-900">{total}</span></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ====== BAR CHART ======
function BarChart({ distribution }) {
  // distribution = { "0-25": n, "26-50": n, "51-75": n, "76-100": n }
  const bars = [
    { label: "0-25", value: distribution["0-25"] || 0, color: "bg-red-400" },
    { label: "26-50", value: distribution["26-50"] || 0, color: "bg-orange-400" },
    { label: "51-75", value: distribution["51-75"] || 0, color: "bg-amber-400" },
    { label: "76-100", value: distribution["76-100"] || 0, color: "bg-emerald-400" },
  ];
  const maxVal = Math.max(...bars.map(b => b.value), 1);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribusi Nilai</h3>
      {bars.every(b => b.value === 0) ? (
        <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
          Belum ada data nilai
        </div>
      ) : (
        <div className="flex items-end justify-around gap-3 h-40">
          {bars.map((bar, idx) => (
            <div key={idx} className="flex flex-col items-center gap-1 flex-1">
              <span className="text-xs font-semibold text-gray-700">{bar.value}</span>
              <div className="w-full flex justify-center">
                <div
                  className={`w-10 ${bar.color} rounded-t-lg animate-draw-bar`}
                  style={{
                    height: `${Math.max((bar.value / maxVal) * 120, 4)}px`,
                    animationDelay: `${idx * 0.1}s`
                  }}
                ></div>
              </div>
              <span className="text-xs text-gray-500 font-medium">{bar.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== RECENT ACTIVITY ======
function RecentActivity({ activities }) {
  const statusColors = {
    submitted: "bg-emerald-500",
    blocked: "bg-red-500",
    time_expired: "bg-amber-500",
    in_progress: "bg-blue-500",
  };
  const statusLabels = {
    submitted: "Selesai",
    blocked: "Diblokir",
    time_expired: "Waktu Habis",
    in_progress: "Sedang Mengerjakan",
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Aktivitas Terbaru</h3>
      {activities.length === 0 ? (
        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
          Belum ada aktivitas
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {activities.slice(0, 10).map((act, idx) => (
            <div key={idx} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
              <div className={`w-2 h-2 rounded-full ${statusColors[act.status] || "bg-gray-400"} flex-shrink-0`}></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{act.studentName}</p>
                <p className="text-xs text-gray-500">{act.examTitle || "Ujian"} • {act.className}</p>
              </div>
              <div className="flex-shrink-0">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  act.status === "submitted" ? "bg-emerald-100 text-emerald-700" :
                  act.status === "blocked" ? "bg-red-100 text-red-700" :
                  act.status === "time_expired" ? "bg-amber-100 text-amber-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
                  {statusLabels[act.status] || act.status}
                </span>
              </div>
              {act.score !== undefined && act.score !== null && (
                <div className="flex-shrink-0 text-sm font-bold text-gray-900 w-10 text-right">
                  {act.score}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ====== MAIN EXPORT ======
export default function DashboardCharts({ attempts, exams }) {
  const chartData = useMemo(() => {
    let passed = 0;
    let failed = 0;
    const distribution = { "0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0 };
    const activities = [];

    // Build exam title map
    const examMap = {};
    exams.forEach(e => { examMap[e.id] = e; });

    attempts.forEach((a) => {
      const exam = examMap[a.examId] || {};
      const kkm = exam.minimumScore || 75;

      if (a.status === "submitted" || a.status === "time_expired") {
        const score = a.score || 0;
        if (score >= kkm) passed++;
        else failed++;

        if (score <= 25) distribution["0-25"]++;
        else if (score <= 50) distribution["26-50"]++;
        else if (score <= 75) distribution["51-75"]++;
        else distribution["76-100"]++;
      }

      activities.push({
        ...a,
        examTitle: exam.title || "Ujian",
      });
    });

    // Sort activities by most recent (handling Firestore Timestamps)
    activities.sort((a, b) => {
      const getMillis = (val) => {
        if (!val) return 0;
        if (val.toMillis) return val.toMillis();
        if (val.toDate) return val.toDate().getTime();
        if (val.seconds) return val.seconds * 1000;
        if (typeof val === 'string' || typeof val === 'number') return new Date(val).getTime();
        return 0;
      };
      
      const ta = getMillis(a.submittedAt || a.updatedAt || a.startedAt || a.createdAt);
      const tb = getMillis(b.submittedAt || b.updatedAt || b.startedAt || b.createdAt);
      return tb - ta;
    });

    return { passed, failed, total: passed + failed, distribution, activities };
  }, [attempts, exams]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <DonutChart passed={chartData.passed} failed={chartData.failed} total={chartData.total} />
      <BarChart distribution={chartData.distribution} />
      <RecentActivity activities={chartData.activities} />
    </div>
  );
}
