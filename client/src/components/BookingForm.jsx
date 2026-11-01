
import { useEffect, useState } from "react";
import "./BookingForm.css";
import { API_URL } from "../services/api";

export default function BookingForm({ trip, from, to, user, onClose }) {
  const [seatNumber, setSeatNumber] = useState("");
  const [passengerName, setPassengerName] = useState(user?.name || "");
  const [passengerPhone, setPassengerPhone] = useState("");

  const [bookedSeats, setBookedSeats] = useState([]);
  const [loadingSeats, setLoadingSeats] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const capacity = Number(trip.bus?.capacity) || 0;

  // Load occupied seats for the selected journey.
  useEffect(() => {
    let cancelled = false;

    async function loadOccupiedSeats() {
      try {
        setLoadingSeats(true);
        setError("");
        setSeatNumber("");

        const params = new URLSearchParams({
          tripId: trip.tripId,
          from,
          to,
        });

        const response = await fetch(
          `${API_URL}/bookings/availability?${params.toString()}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Could not load seat availability."
          );
        }

        if (!cancelled) {
          setBookedSeats(
            (data.occupiedSeats || []).map(String)
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
          setBookedSeats([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSeats(false);
        }
      }
    }

    loadOccupiedSeats();

    return () => {
      cancelled = true;
    };
  }, [trip.tripId, from, to]);

  // Submit booking.
  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setConfirmation(null);

    if (!seatNumber) {
      setError("Please select a seat.");
      return;
    }

    if (bookedSeats.includes(seatNumber)) {
      setError("This seat is already occupied. Please select another.");
      return;
    }

    if (!passengerName.trim() || !passengerPhone.trim()) {
      setError("Please enter your name and phone number.");
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem("busgoToken");
      const bookingData = {
        tripId: trip.tripId,
        passengerName: passengerName.trim(),
        passengerPhone: passengerPhone.trim(),
        seatNumber,
        fromStopCode: from,
        toStopCode: to,
      };

      const response = await fetch(`${API_URL}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(bookingData)
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

  return (
    <div className="booking-overlay">
      <section
        className="booking-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
      >
        {/* Header */}
        <div className="booking-header">
          <div>
            <span className="booking-eyebrow">YOUR JOURNEY</span>

            <h2 id="booking-title">Choose your seat</h2>

            <p>
              {from} → {to} · {trip.bus?.registrationNumber}
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

        {/* Booking confirmation */}
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
            {/* Seat legend */}
            <div className="seat-legend">
              <span>
                <i className="legend-seat available" /> Available
              </span>

              <span>
                <i className="legend-seat selected" /> Selected
              </span>

              <span>
                <i className="legend-seat occupied" /> Unavailable
              </span>
            </div>

            {/* Bus seat layout */}
            <div className="bus-layout">
              <div className="driver-area">
                <span>FRONT OF BUS</span>
                <span className="steering-wheel">◉</span>
              </div>

              {loadingSeats ? (
                <p className="seat-message">
                  Checking seat availability...
                </p>
              ) : error ? (
                <p className="seat-message booking-error">
                  {error}
                </p>
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
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        disabled={occupied}
                        onClick={() => setSeatNumber(seat)}
                        aria-label={`Seat ${seat}${
                          occupied ? ", unavailable" : ""
                        }`}
                      >
                        {seat}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Passenger details */}
            <form
              className="passenger-form"
              onSubmit={handleSubmit}
            >
              <div className="selected-seat-info">
                <span>Selected seat</span>
                <strong>{seatNumber || "None selected"}</strong>
              </div>

              <label htmlFor="passengerName">
                Passenger name
              </label>

              <input
                id="passengerName"
                type="text"
                value={passengerName}
                onChange={(event) =>
                  setPassengerName(event.target.value)
                }
                placeholder="Enter your full name"
                minLength={2}
                required
              />

              <label htmlFor="passengerPhone">
                Phone number
              </label>

              <input
                id="passengerPhone"
                type="tel"
                value={passengerPhone}
                onChange={(event) =>
                  setPassengerPhone(event.target.value)
                }
                placeholder="e.g. 0771234567"
                required
              />

              {error && (
                <p className="booking-error">{error}</p>
              )}

              <button
                className="confirm-button"
                type="submit"
                disabled={
                  submitting ||
                  loadingSeats ||
                  !capacity ||
                  !seatNumber ||
                  !!error
                }
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
