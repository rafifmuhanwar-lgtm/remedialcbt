"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useNotification } from "@/context/NotificationContext";
import { collection, query, getDocs, updateDoc, doc, deleteDoc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { UsersRound, Plus, Trash2, Power, PowerOff, ShieldCheck, Mail, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TeachersPage() {
  const { user, isAdmin } = useAuth();
  const router = useRouter();
  const { addNotification } = useNotification();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "", displayName: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user && !isAdmin) {
      router.push("/dashboard");
      return;
    }
    
    if (isAdmin) {
      fetchTeachers();
    }
  }, [user, isAdmin, router]);

  const fetchTeachers = async () => {
    setLoading(true);
    try {
      const usersRef = collection(db, "users");
      const snap = await getDocs(query(usersRef));
      const data = [];
      snap.forEach(d => {
        data.push({ id: d.id, ...d.data() });
      });
      setTeachers(data.filter(u => u.role !== 'admin' || u.id === user?.uid)); // show all, but admin can see themselves
    } catch (err) {
      console.error(err);
      addNotification("error", "Gagal", "Gagal mengambil data guru.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTeacher = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) return;
    
    setSubmitting(true);
    try {
      const userCred = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      // Simpan data role guru ke Firestore menggunakan user yang baru terbentuk
      await setDoc(doc(db, "users", userCred.user.uid), {
        email: formData.email,
        displayName: formData.displayName || formData.email.split('@')[0],
        role: 'teacher',
        status: 'active',
        createdAt: new Date().toISOString()
      });
      
      setFormData({ email: "", password: "", displayName: "" });
      setIsAdding(false);
      addNotification("success", "Berhasil", "Akun guru baru ditambahkan. Anda akan otomatis logout.");
      // Force reload to apply logout state properly
      setTimeout(() => window.location.href = '/', 2000);
    } catch (err) {
      console.error(err);
      addNotification("error", "Gagal", err.message || "Gagal menambahkan guru.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      await updateDoc(doc(db, "users", id), { status: newStatus });
      fetchTeachers();
      addNotification("success", "Status Diperbarui", `Akun guru sekarang ${newStatus === 'active' ? 'Aktif' : 'Nonaktif'}.`);
    } catch (error) {
      console.error("Error updating status:", error);
      addNotification("error", "Gagal", "Tidak dapat memperbarui status guru.");
    }
  };

  const deleteTeacher = async (id) => {
    if (confirm("Hapus akun guru ini? Semua ujian milik guru ini tidak akan dapat diakses olehnya lagi.")) {
      try {
        await deleteDoc(doc(db, "users", id));
        fetchTeachers();
        addNotification("success", "Berhasil", "Akun guru telah dihapus.");
      } catch (error) {
        console.error("Error deleting teacher:", error);
        addNotification("error", "Gagal", "Tidak dapat menghapus akun guru.");
      }
    }
  };

  if (!isAdmin) return null; // Prevent flicker

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <UsersRound className="w-6 h-6 mr-2 text-indigo-600" /> Kelola Guru
          </h1>
          <p className="mt-1 text-sm text-gray-500">Manajemen akun guru untuk platform RemedialCBT.</p>
        </div>
        <div>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" />
            {isAdding ? "Batal Tambah" : "Tambah Guru"}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white rounded-xl shadow-sm border border-indigo-200 p-6 animate-fade-in">
          <h3 className="text-md font-bold mb-4 text-indigo-900">Tambah Akun Guru Baru</h3>
          <form onSubmit={handleAddTeacher} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email Address</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-gray-400" />
                  </div>
                  <input type="email" required value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} className="block w-full pl-10 sm:text-sm border-gray-300 rounded-md p-2 border focus:border-indigo-500 focus:ring-indigo-500" placeholder="guru@sekolah.com" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Password Sementara</label>
                <input type="text" required value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} className="mt-1 block w-full sm:text-sm border-gray-300 rounded-md p-2 border focus:border-indigo-500 focus:ring-indigo-500" placeholder="Minimal 6 karakter" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="submit" disabled={submitting} className="inline-flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Simpan Akun
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
        </div>
      ) : (
        <div className="bg-white shadow-sm border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Informasi Guru</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{t.displayName || t.email.split('@')[0]}</div>
                      <div className="text-sm text-gray-500">{t.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {t.role === 'admin' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          <ShieldCheck className="w-3 h-3 mr-1" /> Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Guru
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {t.role === 'admin' ? (
                        <span className="text-sm text-gray-500">System</span>
                      ) : (
                        <button
                          onClick={() => toggleStatus(t.id, t.status)}
                          className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-medium ${
                            t.status === "active" 
                              ? "bg-green-100 text-green-800 hover:bg-green-200" 
                              : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                          }`}
                        >
                          {t.status === "active" ? (
                            <><Power className="w-3 h-3 mr-1" /> Aktif</>
                          ) : (
                            <><PowerOff className="w-3 h-3 mr-1" /> Nonaktif</>
                          )}
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {t.role !== 'admin' && (
                        <button onClick={() => deleteTeacher(t.id)} className="text-red-600 hover:text-red-900 ml-4 p-2 hover:bg-red-50 rounded-lg">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
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
