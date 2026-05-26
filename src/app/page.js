"use client";

import Link from "next/link";
import { BookOpenCheck } from "lucide-react";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-white">
      <div className="w-full max-w-md text-center space-y-8">
        
        {/* Logo & Branding */}
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg shadow-indigo-200">
            <BookOpenCheck className="w-12 h-12 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
            Remedial<span className="text-indigo-600">CBT</span>
          </h1>
          <p className="text-lg text-gray-500">
            Platform CBT sederhana untuk ujian remedial berbasis link dan kode ujian.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="pt-8">
          <Link
            href="/login"
            className="w-full flex items-center justify-center px-8 py-4 border border-transparent text-lg font-medium rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Login Guru
          </Link>
        </div>

      </div>
    </main>
  );
}
