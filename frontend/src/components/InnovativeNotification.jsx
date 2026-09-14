import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconX, IconAlertTriangle } from "./Icons";
import "./InnovativeNotification.css";

export function InnovativeToast({
  notification,
  onClose,
  duration = 4500,
}) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) return;

    setProgress(100);
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);

      if (elapsed >= duration) {
        clearInterval(interval);
        onClose();
      }
    }, 25);

    return () => clearInterval(interval);
  }, [notification, duration, onClose]);

  if (!notification) return null;

  const { type = "success", title, message } = notification;

  const iconByType = {
    success: <IconCheck size={18} />,
    error: <IconX size={18} />,
    warning: <IconAlertTriangle size={18} />,
    info: <IconCheck size={18} />,
  };

  const toastContent = (
    <div className={`innovative-toast-container ${type}`} role="alert">
      <div className="innovative-toast-card">
        <div className={`toast-icon-wrapper ${type}`}>
          {iconByType[type] || <IconCheck size={18} />}
        </div>
        <div className="toast-content">
          {title && <h4 className="toast-title">{title}</h4>}
          <p className="toast-message">{message}</p>
        </div>
        <button
          type="button"
          className="toast-close-btn"
          onClick={onClose}
          title="Dismiss notification"
        >
          <IconX size={14} />
        </button>
        <div
          className="toast-progress-bar"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(toastContent, document.body)
    : toastContent;
}

export default InnovativeToast;
