
import { useEffect, useState } from "react";
import "./BookingForm.css";

const API_URL = "http://localhost:5000/api";

export default function BookingForm({ trip, from, to, onClose }) {
  const [seatNumber, setSeatNumber] = useState("");
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [bookedSeats, setBookedSeats] = useState([]);
  const [loadingSeats, setLoadingSeats] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  // Load existing bookings to display unavailable seats.
  useEffect(() => {
    let cancelled = false;

    async function loadBookings() {
      try {
        const response = await fetch(`${API_URL}/bookings`);

        if (!response.ok) {
          throw new Error("Could not load seat availability.");
        }

        const data = await response.json();
        const bookings = data.bookings || [];

        // Mark seats unavailable if their journeys overlap
        // the passenger's selected journey.
        const seats = bookings
          .filter((booking) => {
            const active =
              booking.status === "PENDING" ||
              booking.status === "CONFIRMED";

            if (!active || booking.trip?._id !== trip.tripId) {
              return false;
            }

            const routeStops = trip.route?.stops;

            // The search API may not return the full route.
            // If it doesn't, use the server-side booking check
            // as the final authority during submission.
            if (!Array.isArray(routeStops)) {
              return false;
            }

            const existingFrom = routeStops.findIndex(
              (stop) => stop.stopCode === booking.fromStopCode
            );
            const existingTo = routeStops.findIndex(
              (stop) => stop.stopCode === booking.toStopCode
            );
            const selectedFrom = routeStops.findIndex(
              (stop) => stop.stopCode === from
            );
            const selectedTo = routeStops.findIndex(
              (stop) => stop.stopCode === to
            );

            return (
              existingFrom !== -1 &&
              existingTo !== -1 &&
              selectedFrom !== -1 &&
              selectedTo !== -1 &&
              selectedFrom < existingTo &&
              existingFrom < selectedTo
            );
          })
          .map((booking) => String(booking.seatNumber));

        if (!cancelled) {
          setBookedSeats(seats);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      } finally {
        if (!cancelled) {
          setLoadingSeats(false);
        }
      }
    }

    loadBookings();

    return () => {
      cancelled = true;
    };
  }, [trip, from, to]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setConfirmation(null);

    if (!seatNumber) {
      setError("Please select a seat.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tripId: trip.tripId,
          passengerName,
          passengerPhone,
          seatNumber,
          fromStopCode: from,
          toStopCode: to,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Booking failed.");
      }

      setConfirmation(data.booking);
      setSeatNumber("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const capacity = Number(trip.bus.capacity) || 0;

  return (
    <div className="booking-overlay">
      <section
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
      >
        <div className="booking-header">
          <div>
            <span className="booking-eyebrow">YOUR JOURNEY</span>
            <h2 id="booking-title">Choose your seat</h2>
            <p>
              {from} → {to} · {trip.bus.registrationNumber}
            </p>
          </div>

          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close booking"
          >
            ×
          </button>
        </div>

        {confirmation ? (
          <div className="booking-success">
            <div className="success-icon">✓</div>
            <h3>Booking created!</h3>
            <p>Your booking has been saved.</p>

            <div className="confirmation-details">
              <div>
                <span>Booking reference</span>
                <strong>{confirmation._id}</strong>
              </div>
              <div>
                <span>Passenger</span>
                <strong>{confirmation.passengerName}</strong>
              </div>
              <div>
                <span>Seat</span>
                <strong>{confirmation.seatNumber}</strong>
              </div>
              <div>
                <span>Fare</span>
                <strong>
                  Rs. {Number(confirmation.fare).toLocaleString("en-LK")}
                </strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{confirmation.status}</strong>
              </div>
            </div>

            <button
              type="button"
              className="confirm-button"
              onClick={onClose}
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="seat-legend">
              <span><i className="legend-seat available" /> Available</span>
              <span><i className="legend-seat selected" /> Selected</span>
              <span><i className="legend-seat occupied" /> Unavailable</span>
            </div>

            <div className="bus-layout">
              <div className="driver-area">
                <span>FRONT OF BUS</span>
                <span className="steering-wheel">◉</span>
              </div>

              {loadingSeats ? (
                <p className="seat-message">Checking seat availability...</p>
              ) : capacity <= 0 ? (
                <p className="seat-message">
                  Bus capacity is unavailable.
                </p>
              ) : (
                <div className="seat-grid">
                  {Array.from({ length: capacity }, (_, index) => {
                    const seat = String(index + 1);
                    const occupied = bookedSeats.includes(seat);
                    const selected = seatNumber === seat;

                    return (
                      <button
                        key={seat}
                        type="button"
                        className={[
                          "seat",
                          occupied ? "occupied" : "",
                          selected ? "selected" : "",
                        ].filter(Boolean).join(" ")}
                        disabled={occupied}
                        onClick={() => setSeatNumber(seat)}
                        aria-label={`Seat ${seat}${occupied ? ", unavailable" : ""}`}
                      >
                        {seat}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <form className="passenger-form" onSubmit={handleSubmit}>
              <div className="selected-seat-info">
                <span>Selected seat</span>
                <strong>{seatNumber || "None selected"}</strong>
              </div>

              <label htmlFor="passengerName">Passenger name</label>
              <input
                id="passengerName"
                value={passengerName}
                onChange={(event) => setPassengerName(event.target.value)}
                placeholder="Enter your full name"
                minLength={2}
                required
              />

              <label htmlFor="passengerPhone">Phone number</label>
              <input
                id="passengerPhone"
                type="tel"
                value={passengerPhone}
                onChange={(event) => setPassengerPhone(event.target.value)}
                placeholder="e.g. 0771234567"
                required
              />

              {error && <p className="booking-error">{error}</p>}

              <button
                className="confirm-button"
                type="submit"
                disabled={submitting || loadingSeats || !capacity}
              >
                {submitting ? "Booking..." : "Confirm booking"}
              </button>

              <p className="booking-note">
                This development version creates a pending booking.
                Online payments are not enabled.
              </p>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
