import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { getNotifications, markAllNotificationsRead } from "../services/api";
import { supabase } from "../lib/supabase";
import "./NotificationsPage.css";

function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        setError("");

        const { data } = await supabase.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) {
          setError("Please log in to see your notifications.");
          return;
        }

        const notificationsData = await getNotifications(userId);

        setNotifications(notificationsData);
      } catch (error) {
        console.error("Error fetching notifications:", error);
        setError("Unable to load notifications.");
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  const handleMarkAllRead = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return;

      await markAllNotificationsRead(userId);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "RENTAL_REQUEST":
        return "Email";

      case "REQUEST_APPROVED":
        return "Approved";

      case "REQUEST_REJECTED":
        return "Rejected";

      case "PAYMENT":
        return "Payment";

      case "RENTAL_REMINDER":
        return "Reminder";

      case "RETURN":
        return "Return";

      default:
        return "Alert";
    }
  };
  const formatDate = (date) => {
    if (!date) {
      return "";
    }

    return new Date(date).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="notifications-page">
      <Navbar />

      <div className="notifications-breadcrumb">
        <Link to="/">Home</Link>
        <span>/</span>
        <span>Notifications</span>
      </div>

      <section className="notifications-header">
        <div>
          <h1>Notifications</h1>
          <p>
            Stay updated with your rentals, requests,
            payments and product activities.
          </p>
        </div>

        {notifications.length > 0 && (
          <button className="mark-all-button" onClick={handleMarkAllRead}>
            Mark all as read
          </button>
        )}
      </section>

      <main className="notifications-container">

        {loading && (
          <div className="notifications-message">
            <p>Loading notifications...</p>
          </div>
        )}

        {!loading && error && (
          <div className="notifications-message error-message">
            <h2>Something went wrong</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading &&
          !error &&
          notifications.length === 0 && (
            <div className="notifications-empty">
              <div className="empty-icon">No Notifications</div>

              <h2>No Notifications</h2>

              <p>
                You don't have any notifications right now.
                We'll notify you when there is new activity.
              </p>

              <Link
                to="/products"
                className="browse-products-button"
              >
                Browse Products
              </Link>
            </div>
          )}

        {!loading &&
          !error &&
          notifications.length > 0 && (
            <div className="notifications-list">

              {notifications.map((notification) => (
                <div
                  key={notification.notificationId}
                  className={
                    notification.isRead
                      ? "notification-card"
                      : "notification-card unread"
                  }
                >
                  <div className="notification-icon">
                    {getNotificationIcon(
                      notification.type
                    )}
                  </div>

                  <div className="notification-content">
                    <div className="notification-title-row">
                      <h3>{notification.title}</h3>

                      {!notification.isRead && (
                        <span className="unread-dot"></span>
                      )}
                    </div>

                    <p className="notification-message">
                      {notification.message}
                    </p>

                    <span className="notification-time">
                      {formatDate(
                        notification.createdAt
                      )}
                    </span>
                  </div>
                </div>
              ))}

            </div>
          )}

      </main>

      <Footer />
    </div>
  );
}

export default NotificationsPage;