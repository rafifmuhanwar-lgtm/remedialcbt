"use client";

import { useNotification } from "@/context/NotificationContext";
import { X, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { useEffect, useState } from "react";

const typeConfig = {
  success: {
    icon: CheckCircle,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    iconColor: "text-emerald-500",
    titleColor: "text-emerald-900",
    textColor: "text-emerald-700",
    progressColor: "bg-emerald-500",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    border: "border-amber-200",
    iconColor: "text-amber-500",
    titleColor: "text-amber-900",
    textColor: "text-amber-700",
    progressColor: "bg-amber-500",
  },
  error: {
    icon: XCircle,
    bg: "bg-red-50",
    border: "border-red-200",
    iconColor: "text-red-500",
    titleColor: "text-red-900",
    textColor: "text-red-700",
    progressColor: "bg-red-500",
  },
  info: {
    icon: Info,
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconColor: "text-blue-500",
    titleColor: "text-blue-900",
    textColor: "text-blue-700",
    progressColor: "bg-blue-500",
  },
};

function Toast({ notification, onClose }) {
  const [progress, setProgress] = useState(100);
  const config = typeConfig[notification.type] || typeConfig.info;
  const Icon = config.icon;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - notification.createdAt;
      const remaining = Math.max(0, 100 - (elapsed / notification.duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, [notification.createdAt, notification.duration]);

  return (
    <div
      className={`w-80 rounded-xl border ${config.bg} ${config.border} shadow-lg overflow-hidden transform transition-all duration-300 animate-slide-in-right`}
    >
      <div className="p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>
          <div className="ml-3 flex-1">
            <p className={`text-sm font-semibold ${config.titleColor}`}>{notification.title}</p>
            {notification.message && (
              <p className={`mt-1 text-sm ${config.textColor}`}>{notification.message}</p>
            )}
          </div>
          <div className="ml-4 flex-shrink-0 flex">
            <button
              onClick={() => onClose(notification.id)}
              className="inline-flex rounded-md text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-1 w-full bg-gray-100">
        <div
          className={`h-full ${config.progressColor} transition-all duration-100 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function ToastContainer() {
  const { notifications, removeNotification } = useNotification();

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3">
      {notifications.map((notif) => (
        <Toast key={notif.id} notification={notif} onClose={removeNotification} />
      ))}
    </div>
  );
}
