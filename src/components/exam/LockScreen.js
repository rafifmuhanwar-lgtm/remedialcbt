import { useState } from "react";
import { Lock, ShieldAlert, AlertTriangle } from "lucide-react";

export function LockScreen({ reason, maxViolations, violationCount, onUnlock, onBlocked, examPin }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (pin === examPin) {
      onUnlock();
    } else {
      setError("PIN salah. Silakan minta PIN yang benar dari pengawas Anda.");
    }
  };

  const isBlocked = violationCount >= maxViolations;

  if (isBlocked) {
    // Notify parent to block
    onBlocked();
    return (
      <div className="fixed inset-0 bg-red-900 bg-opacity-95 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
          <ShieldAlert className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ujian Diblokir</h2>
          <p className="text-gray-600 mb-6">
            Anda telah melanggar batas maksimal keluar dari halaman ujian ({maxViolations} kali). 
            Ujian Anda otomatis diblokir dan tidak dapat dilanjutkan.
          </p>
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <p className="text-sm font-medium text-red-800">Silakan lapor ke guru pengawas.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-95 z-50 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
        <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ujian Terkunci</h2>
        <p className="text-red-600 font-medium text-sm mb-4">{reason}</p>
        
        <div className="bg-orange-50 p-3 rounded-lg mb-6 border border-orange-100">
          <p className="text-sm text-orange-800">
            Pelanggaran ke-{violationCount + 1} dari maksimal {maxViolations} kali.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {error && <p className="text-sm text-red-600 font-medium text-center">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Masukkan PIN dari Guru</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="pl-10 block w-full border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm p-3 border tracking-widest font-mono text-lg text-center"
                placeholder="PIN UJIAN"
                autoComplete="off"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Lanjutkan Ujian
          </button>
        </form>
      </div>
    </div>
  );
}
