"use client";

import { useEffect, useState } from "react";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Plus, Trash2, Check, BookOpen, AlertCircle, Save, Pencil, X } from "lucide-react";

export default function QuestionsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingExams, setLoadingExams] = useState(true);
  const [isAdding, setIsAdding] = useState(false);

  // Form states for adding new questions
  const [questionType, setQuestionType] = useState("multiple_choice");
  const [questionText, setQuestionText] = useState("");
  const [scoreWeight, setScoreWeight] = useState(10);
  const [options, setOptions] = useState([{ text: "", isCorrect: true }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }]);
  const [tfAnswer, setTfAnswer] = useState(true);

  // Edit states
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    const fetchExams = async () => {
      if (!user) return;
      try {
        const q = query(collection(db, "exams"), where("teacherId", "==", user.uid));
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
  }, [user]);

  const fetchQuestions = async (examId) => {
    setLoading(true);
    try {
      const q = query(collection(db, "questions"), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      const qData = [];
      querySnapshot.forEach((doc) => {
        qData.push({ id: doc.id, ...doc.data() });
      });
      // Sort or something, for now just set
      setQuestions(qData);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      fetchQuestions(selectedExamId);
    } else {
      setQuestions([]);
    }
  }, [selectedExamId]);

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index].text = value;
    setOptions(newOptions);
  };

  const handleSetCorrectOption = (index) => {
    const newOptions = options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index
    }));
    setOptions(newOptions);
  };

  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    if (!selectedExamId) return;

    let correctAnswer = "";
    if (questionType === "multiple_choice") {
      const correctOpt = options.find(o => o.isCorrect);
      if (!correctOpt || !correctOpt.text) {
        alert("Pilihan benar tidak boleh kosong!");
        return;
      }
      correctAnswer = correctOpt.text;
    } else if (questionType === "true_false") {
      correctAnswer = tfAnswer.toString();
    }

    try {
      const qData = {
        examId: selectedExamId,
        questionText,
        questionType,
        scoreWeight: Number(scoreWeight),
        correctAnswer: questionType === "essay" ? null : correctAnswer,
        options: questionType === "multiple_choice" ? options.map(o => o.text) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      await addDoc(collection(db, "questions"), qData);
      
      // Reset form
      setQuestionText("");
      setOptions([{ text: "", isCorrect: true }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }]);
      setIsAdding(false);
      
      fetchQuestions(selectedExamId);
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan soal");
    }
  };

  const deleteQuestion = async (id) => {
    if (confirm("Hapus soal ini?")) {
      try {
        await deleteDoc(doc(db, "questions", id));
        fetchQuestions(selectedExamId);
      } catch (error) {
        console.error(error);
      }
    }
  };

  // --- Edit logic ---
  const startEditing = (q) => {
    setEditingId(q.id);
    const editOptions = q.questionType === "multiple_choice" && q.options
      ? q.options.map(optText => ({ text: optText, isCorrect: optText === q.correctAnswer }))
      : [{ text: "", isCorrect: true }, { text: "", isCorrect: false }, { text: "", isCorrect: false }, { text: "", isCorrect: false }];
    setEditData({
      questionText: q.questionText || "",
      questionType: q.questionType || "multiple_choice",
      scoreWeight: q.scoreWeight ?? 10,
      options: editOptions,
      tfAnswer: q.correctAnswer === "true",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData(null);
  };

  const handleEditOptionChange = (index, value) => {
    const newOpts = [...editData.options];
    newOpts[index].text = value;
    setEditData({ ...editData, options: newOpts });
  };

  const handleEditSetCorrectOption = (index) => {
    const newOpts = editData.options.map((opt, i) => ({ ...opt, isCorrect: i === index }));
    setEditData({ ...editData, options: newOpts });
  };

  const handleUpdateQuestion = async (e) => {
    e.preventDefault();
    if (!editData || !editingId) return;
    setSaving(true);

    let correctAnswer = "";
    if (editData.questionType === "multiple_choice") {
      const correctOpt = editData.options.find(o => o.isCorrect);
      if (!correctOpt || !correctOpt.text) {
        alert("Pilihan benar tidak boleh kosong!");
        setSaving(false);
        return;
      }
      correctAnswer = correctOpt.text;
    } else if (editData.questionType === "true_false") {
      correctAnswer = editData.tfAnswer.toString();
    }

    try {
      const updatePayload = {
        questionText: editData.questionText,
        questionType: editData.questionType,
        scoreWeight: Number(editData.scoreWeight),
        correctAnswer: editData.questionType === "essay" ? null : correctAnswer,
        options: editData.questionType === "multiple_choice" ? editData.options.map(o => o.text) : null,
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, "questions", editingId), updatePayload);
      setEditingId(null);
      setEditData(null);
      fetchQuestions(selectedExamId);
    } catch (error) {
      console.error(error);
      alert("Gagal menyimpan perubahan");
    } finally {
      setSaving(false);
    }
  };

  // --- Render edit form for a question ---
  const renderEditForm = (q) => (
    <div key={q.id} className="bg-white rounded-xl shadow-sm border-2 border-indigo-400 p-5">
      <form onSubmit={handleUpdateQuestion} className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-indigo-700">Edit Soal</h3>
          <button type="button" onClick={cancelEditing} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Tipe Soal</label>
            <select
              value={editData.questionType}
              onChange={(e) => setEditData({ ...editData, questionType: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            >
              <option value="multiple_choice">Pilihan Ganda</option>
              <option value="true_false">Benar / Salah</option>
              <option value="essay">Essay Singkat</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Bobot Nilai</label>
            <input
              type="number" min="0.01" step="0.01" required
              value={editData.scoreWeight}
              onChange={(e) => setEditData({ ...editData, scoreWeight: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Pertanyaan</label>
          <textarea
            required rows="3"
            value={editData.questionText}
            onChange={(e) => setEditData({ ...editData, questionText: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
            placeholder="Tulis pertanyaan di sini..."
          ></textarea>
        </div>

        {editData.questionType === "multiple_choice" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Pilihan Jawaban (Pilih yang benar)</label>
            {editData.options.map((opt, idx) => (
              <div key={idx} className="flex items-center space-x-3">
                <input
                  type="radio"
                  name="editCorrectOption"
                  checked={opt.isCorrect}
                  onChange={() => handleEditSetCorrectOption(idx)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                />
                <input
                  type="text"
                  required
                  value={opt.text}
                  onChange={(e) => handleEditOptionChange(idx, e.target.value)}
                  placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                  className={`flex-1 rounded-md shadow-sm sm:text-sm p-2 border ${opt.isCorrect ? 'border-green-500 ring-1 ring-green-500 bg-green-50' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                />
              </div>
            ))}
          </div>
        )}

        {editData.questionType === "true_false" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Kunci Jawaban</label>
            <div className="flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input type="radio" checked={editData.tfAnswer === true} onChange={() => setEditData({ ...editData, tfAnswer: true })} className="form-radio h-4 w-4 text-indigo-600" />
                <span className="ml-2">Benar</span>
              </label>
              <label className="inline-flex items-center">
                <input type="radio" checked={editData.tfAnswer === false} onChange={() => setEditData({ ...editData, tfAnswer: false })} className="form-radio h-4 w-4 text-indigo-600" />
                <span className="ml-2">Salah</span>
              </label>
            </div>
          </div>
        )}

        {editData.questionType === "essay" && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded-lg">
            Jawaban essay tidak memiliki kunci otomatis. Anda harus menilainya secara manual di menu Hasil.
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
          <button type="button" onClick={cancelEditing} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Batal</button>
          <button type="submit" disabled={saving} className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
            <Save className="w-4 h-4 mr-2" /> {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </form>
    </div>
  );

  // --- Render read-only question card ---
  const renderQuestionCard = (q, idx) => (
    <div key={q.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-indigo-200 transition-colors">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase">
              {q.questionType.replace('_', ' ')}
            </span>
            <span className="text-xs text-gray-500">Bobot: {q.scoreWeight}</span>
          </div>
          <p className="text-gray-900 font-medium">{idx + 1}. {q.questionText}</p>
          
          {q.questionType === 'multiple_choice' && q.options && (
            <div className="mt-3 space-y-2 pl-4">
              {q.options.map((opt, i) => (
                <div key={i} className={`text-sm flex items-center ${opt === q.correctAnswer ? 'text-green-600 font-medium' : 'text-gray-600'}`}>
                  <span className="w-6">{String.fromCharCode(65 + i)}.</span>
                  {opt}
                  {opt === q.correctAnswer && <Check className="w-4 h-4 ml-2 text-green-500" />}
                </div>
              ))}
            </div>
          )}

          {q.questionType === 'true_false' && (
            <div className="mt-3 text-sm text-green-600 font-medium flex items-center">
              <Check className="w-4 h-4 mr-2 text-green-500" />
              Jawaban Benar: {q.correctAnswer === 'true' ? 'Benar' : 'Salah'}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-1 ml-4">
          <button onClick={() => startEditing(q)} className="text-gray-400 hover:text-indigo-600 p-2 bg-gray-50 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit soal">
            <Pencil className="w-5 h-5" />
          </button>
          <button onClick={() => deleteQuestion(q.id)} className="text-gray-400 hover:text-red-600 p-2 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors" title="Hapus soal">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kelola Soal</h1>
        <p className="mt-1 text-sm text-gray-500">Tambah dan kelola soal untuk ujian Anda.</p>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Ujian</label>
        {loadingExams ? (
          <div className="h-10 bg-gray-100 rounded-lg animate-pulse w-full max-w-md"></div>
        ) : exams.length === 0 ? (
          <div className="text-sm text-red-500 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            Anda belum memiliki ujian. Silakan buat ujian terlebih dahulu.
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
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">Daftar Soal ({questions.length})</h2>
            <button 
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
            >
              <Plus className="-ml-1 mr-2 h-5 w-5" />
              {isAdding ? "Batal Tambah" : "Tambah Soal"}
            </button>
          </div>

          {isAdding && (
            <div className="bg-white rounded-xl shadow-sm border border-indigo-200 p-6">
              <h3 className="text-md font-bold mb-4 text-indigo-900">Soal Baru</h3>
              <form onSubmit={handleSaveQuestion} className="space-y-4">
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Tipe Soal</label>
                    <select 
                      value={questionType} 
                      onChange={(e) => setQuestionType(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    >
                      <option value="multiple_choice">Pilihan Ganda</option>
                      <option value="true_false">Benar / Salah</option>
                      <option value="essay">Essay Singkat</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Bobot Nilai</label>
                    <input 
                      type="number" min="0.01" step="0.01" required
                      value={scoreWeight} onChange={(e) => setScoreWeight(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Pertanyaan</label>
                  <textarea 
                    required rows="3"
                    value={questionText} onChange={(e) => setQuestionText(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border"
                    placeholder="Tulis pertanyaan di sini..."
                  ></textarea>
                </div>

                {questionType === "multiple_choice" && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Pilihan Jawaban (Pilih yang benar)</label>
                    {options.map((opt, idx) => (
                      <div key={idx} className="flex items-center space-x-3">
                        <input 
                          type="radio" 
                          name="correctOption" 
                          checked={opt.isCorrect} 
                          onChange={() => handleSetCorrectOption(idx)}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300" 
                        />
                        <input 
                          type="text" 
                          required
                          value={opt.text}
                          onChange={(e) => handleOptionChange(idx, e.target.value)}
                          placeholder={`Opsi ${String.fromCharCode(65 + idx)}`}
                          className={`flex-1 rounded-md shadow-sm sm:text-sm p-2 border ${opt.isCorrect ? 'border-green-500 ring-1 ring-green-500 bg-green-50' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {questionType === "true_false" && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700">Kunci Jawaban</label>
                    <div className="flex items-center space-x-4">
                      <label className="inline-flex items-center">
                        <input type="radio" checked={tfAnswer === true} onChange={() => setTfAnswer(true)} className="form-radio h-4 w-4 text-indigo-600" />
                        <span className="ml-2">Benar</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input type="radio" checked={tfAnswer === false} onChange={() => setTfAnswer(false)} className="form-radio h-4 w-4 text-indigo-600" />
                        <span className="ml-2">Salah</span>
                      </label>
                    </div>
                  </div>
                )}

                {questionType === "essay" && (
                  <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm p-3 rounded-lg">
                    Jawaban essay tidak memiliki kunci otomatis. Anda harus menilainya secara manual di menu Hasil.
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">Batal</button>
                  <button type="submit" className="inline-flex justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">
                    <Save className="w-4 h-4 mr-2" /> Simpan
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
             <div className="flex justify-center py-8">
               <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
             </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
              <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada soal</h3>
              <p className="mt-1 text-sm text-gray-500">Ujian ini belum memiliki soal. Silakan tambahkan.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, idx) =>
                editingId === q.id && editData
                  ? renderEditForm(q)
                  : renderQuestionCard(q, idx)
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
