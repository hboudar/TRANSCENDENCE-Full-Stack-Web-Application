"use client";

import { useEffect, useState } from "react";
import { IoClose, IoCheckmarkCircle, IoWarning, IoInformationCircle } from "react-icons/io5";

export type AlertType = "success" | "error" | "warning" | "info";

interface AlertProps {
  message: string;
  type?: AlertType;
  duration?: number;
  onClose?: () => void;
}

const alertStyles = {
  success: {
    bg: "bg-[#2a1f3d]/95",
    border: "border-green-500/50",
    icon: IoCheckmarkCircle,
    iconColor: "text-green-400",
  },
  error: {
    bg: "bg-[#2a1f3d]/95",
    border: "border-red-500/50",
    icon: IoWarning,
    iconColor: "text-red-400",
  },
  warning: {
    bg: "bg-[#2a1f3d]/95",
    border: "border-yellow-500/50",
    icon: IoWarning,
    iconColor: "text-yellow-400",
  },
  info: {
    bg: "bg-[#2a1f3d]/95",
    border: "border-[#7b5ddf]/50",
    icon: IoInformationCircle,
    iconColor: "text-[#7b5ddf]",
  },
};

export function Alert({ message, type = "info", duration = 4000, onClose }: AlertProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  const style = alertStyles[type];
  const Icon = style.icon;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      setIsVisible(false);
      onClose?.();
    }, 300);
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed top-4 right-4 z-[10000] transition-all duration-300 ${
        isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"
      }`}
    >
      <div
        className={`${style.bg} ${style.border} border-2 rounded-xl shadow-2xl backdrop-blur-sm px-6 py-4 min-w-[300px] max-w-[500px]`}
      >
        <div className="flex items-start gap-3">
          <Icon className={`${style.iconColor} text-2xl flex-shrink-0 mt-0.5`} />
          <p className="text-white font-medium text-sm flex-1 leading-relaxed">{message}</p>
          <button
            onClick={handleClose}
            className="text-white/70 hover:text-white transition-colors flex-shrink-0"
            aria-label="Close alert"
          >
            <IoClose size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

// Alert Manager for programmatic alerts
let alertId = 0;
const alertListeners: Array<(alert: AlertConfig) => void> = [];

interface AlertConfig {
  id: number;
  message: string;
  type?: AlertType;
  duration?: number;
}

export function showAlert(message: string, type: AlertType = "info", duration = 4000) {
  const id = alertId++;
  const config: AlertConfig = { id, message, type, duration };
  alertListeners.forEach((listener) => listener(config));
}

export function AlertContainer() {
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);

  useEffect(() => {
    const listener = (alert: AlertConfig) => {
      setAlerts((prev) => [...prev, alert]);
    };

    alertListeners.push(listener);

    return () => {
      const index = alertListeners.indexOf(listener);
      if (index > -1) alertListeners.splice(index, 1);
    };
  }, []);

  const removeAlert = (id: number) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  };

  return (
    <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-3">
      {alerts.map((alert) => (
        <Alert
          key={alert.id}
          message={alert.message}
          type={alert.type}
          duration={alert.duration}
          onClose={() => removeAlert(alert.id)}
        />
      ))}
    </div>
  );
}
