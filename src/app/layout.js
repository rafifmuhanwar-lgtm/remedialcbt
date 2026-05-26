import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import ToastContainer from "@/components/ui/ToastContainer";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "RemedialCBT - Platform Ujian Remedial",
  description: "Platform CBT sederhana untuk ujian remedial berbasis link dan kode ujian.",
  manifest: "/manifest.json",
};

export const viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900 flex flex-col antialiased`}>
        <AuthProvider>
          <NotificationProvider>
            {children}
            <ToastContainer />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
