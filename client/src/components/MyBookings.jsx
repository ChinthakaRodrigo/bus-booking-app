
import { useEffect, useState } from "react";
import "./MyBookings.css";
import { API_URL } from "../services/api";

function MyBookings({ onBack }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchBookings() {
      try {
        const token = localStorage.getItem("busgoToken");

        const response = await fetch(`${API_URL}/bookings/my`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to load bookings.");
        }

        setBookings(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchBookings();
  }, []);

  function formatDate(date) {
    if (!date) return "Not available";

    return new Date(date).toLocaleDateString("en-LK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "Asia/Colombo"
    });
  }

  function formatTime(date) {
    if (!date) return "Not available";

    return new Date(date).toLocaleTimeString("en-LK", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Colombo"
    });
  }

  return (
    <div className="my-bookings-page">
      <div className="my-bookings-header">
        <div>
          <h2>My Bookings</h2>
          <p>Manage your bus reservations</p>
        </div>

        <button onClick={onBack} className="back-button">
          Back to Timetable
        </button>
      </div>

      {loading && <p>Loading your bookings...</p>}

      {error && <p className="booking-error">{error}</p>}

      {!loading && !error && bookings.length === 0 && (
        <div className="empty-bookings">
          <h3>No bookings yet</h3>
          <p>Your bus reservations will appear here.</p>
        </div>
      )}

      {!loading && !error && bookings.length > 0 && (
        <div className="my-bookings-list">
          {bookings.map((booking) => {
            const trip = booking.trip;

            return (
              <div className="my-booking-card" key={booking._id}>
                <div className="booking-card-header">
                  <h3>
                    {trip?.route?.routeName || "Bus journey"}
                  </h3>

                  <span className={`booking-status ${booking.status?.toLowerCase()}`}>
                    {booking.status}
                  </span>
                </div>

                <p>
                  <strong>Bus:</strong>{" "}
                  {trip?.bus?.registrationNumber || "Not available"}
                </p>

                <p>
                  <strong>Travel date:</strong>{" "}
                  {formatDate(trip?.departureTime)}
                </p>

                <p>
                  <strong>Departure:</strong>{" "}
                  {formatTime(trip?.departureTime)}
                </p>

                <p>
                  <strong>Seat:</strong> {booking.seatNumber}
                </p>

                <p>
                  <strong>From:</strong> {booking.fromStopCode}
                </p>

                <p>
                  <strong>To:</strong> {booking.toStopCode}
                </p>

                <p>
                  <strong>Fare:</strong> Rs. {booking.fare}
                </p>

                <p>
                  <strong>Booking reference:</strong> {booking._id}
                </p>
                {booking.status !== "CANCELLED" && (
                  <button
                    type="button"
                    className="back-button"
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem("busgoToken");
                        const response = await fetch(
                          `${API_URL}/bookings/${booking._id}/cancel`,
                          {
                            method: "PATCH",
                            headers: {
                              Authorization: ["Bearer", token].join(" "),
                            },
                          }
                        );
                        const result = await response.json();
                        if (!response.ok) {
                          throw new Error(result.message || "Could not cancel booking.");
                        }
                        setBookings((current) =>
                          current.map((item) =>
                            item._id === booking._id
                              ? { ...item, status: result.booking.status }
                              : item
                          )
                        );
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  >
                    Cancel booking
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MyBookings;
