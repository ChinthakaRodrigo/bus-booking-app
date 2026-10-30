
import { useEffect, useState } from "react";
import "./App.css";
import BookingForm from "./components/BookingForm";

const API_URL = "http://localhost:5000/api";

// Get today's date in local time, avoiding UTC date shifts.
function getToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTime(dateString) {
  if (!dateString) return "Time unavailable";

  return new Date(dateString).toLocaleTimeString("en-LK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Colombo",
  });
}

function App() {
  const [stops, setStops] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState(getToday());

  const [trips, setTrips] = useState([]);
  const [loadingStops, setLoadingStops] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Load available stops from the backend.
  useEffect(() => {
    async function loadStops() {
      try {
        const response = await fetch(`${API_URL}/routes`);

        if (!response.ok) {
          throw new Error("Could not load routes.");
        }

        const routes = await response.json();

        // Collect unique stops from all routes.
        const stopMap = new Map();

        routes.forEach((route) => {
          if (route.status !== "ACTIVE") return;

          (route.stops || []).forEach((stop) => {
            stopMap.set(stop.stopCode, stop);
          });
        });

        const availableStops = Array.from(stopMap.values()).sort(
          (a, b) => a.name.localeCompare(b.name)
        );

        setStops(availableStops);
      } catch (err) {
        setError(
          `${err.message} Make sure your backend is running.`
        );
      } finally {
        setLoadingStops(false);
      }
    }

    loadStops();
  }, []);

  // Search for trips matching the passenger's selections.
  async function handleSearch(event) {
    event.preventDefault();

    setError("");
    setTrips([]);
    setSearched(false);

    if (!from || !to || !date) {
      setError("Please select your origin, destination, and date.");
      return;
    }

    if (from === to) {
      setError("Origin and destination must be different.");
      return;
    }

    setSearching(true);

    try {
      const params = new URLSearchParams({
        from,
        to,
        date,
      });

      const response = await fetch(
        `${API_URL}/trips/search?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Search failed.");
      }

      setTrips(data.trips || []);
      setSearched(true);
    } catch (err) {
      setError(
        `${err.message} Check that the backend is running and the API is available.`
      );
    } finally {
      setSearching(false);
    }
  }

  function getStopName(stopCode) {
    return (
      stops.find((stop) => stop.stopCode === stopCode)?.name ||
      stopCode
    );
  }

  return (
    <div className="app">
      <header className="navbar">
        <a className="brand" href="/">
          <span className="brand-icon">B</span>
          <span>BusGo</span>
        </a>

        <nav>
          <a href="#search">Find Buses</a>
          <a href="#results">Timetable</a>
          <button
            className="nav-button"
            onClick={() =>
              alert("Booking will be added in the next milestone.")
            }
          >
            My Bookings
          </button>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-content">
            <span className="eyebrow">YOUR JOURNEY STARTS HERE</span>

            <h1>
              Every journey,
              <br />
              <span>made simpler.</span>
            </h1>

            <p>
              Find bus schedules, compare departure times,
              and plan your next journey around Sri Lanka.
            </p>

            <a className="hero-link" href="#search">
              Find your bus <span>↓</span>
            </a>
          </div>

          <div className="hero-decoration" aria-hidden="true">
            <div className="road">
              <div className="road-line" />
            </div>
            <div className="bus-illustration">
              <div className="bus-window">
                <span />
                <span />
                <span />
              </div>
              <div className="bus-body-line" />
              <div className="bus-wheel wheel-one" />
              <div className="bus-wheel wheel-two" />
            </div>
            <div className="location-pin pin-one">●</div>
            <div className="location-pin pin-two">●</div>
          </div>
        </section>

        <section className="search-section" id="search">
          <div className="section-heading">
            <span className="eyebrow">PLAN YOUR TRIP</span>
            <h2>Where are you going?</h2>
            <p>Choose your route and travel date to see available buses.</p>
          </div>

          <form className="search-card" onSubmit={handleSearch}>
            <div className="field">
              <label htmlFor="from">From</label>
              <select
                id="from"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                disabled={loadingStops}
                required
              >
                <option value="">
                  {loadingStops ? "Loading stops..." : "Select origin"}
                </option>

                {stops.map((stop) => (
                  <option key={stop.stopCode} value={stop.stopCode}>
                    {stop.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="to">To</label>
              <select
                id="to"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                disabled={loadingStops}
                required
              >
                <option value="">Select destination</option>

                {stops.map((stop) => (
                  <option key={stop.stopCode} value={stop.stopCode}>
                    {stop.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="date">Travel date</label>
              <input
                id="date"
                type="date"
                value={date}
                min={getToday()}
                onChange={(event) => setDate(event.target.value)}
                required
              />
            </div>

            <button
              className="search-button"
              type="submit"
              disabled={searching || loadingStops || stops.length === 0}
            >
              {searching ? "Searching..." : "Search Buses →"}
            </button>
          </form>

          {error && <div className="error-message">{error}</div>}
        </section>

        <section className="results-section" id="results">
          <div className="results-heading">
            <div>
              <span className="eyebrow">YOUR OPTIONS</span>
              <h2>Available buses</h2>
            </div>

            {searched && (
              <span className="result-count">
                {trips.length} {trips.length === 1 ? "bus" : "buses"} found
              </span>
            )}
          </div>

          {!searched && !searching && (
            <div className="empty-state">
              <div className="empty-icon">↗</div>
              <h3>Your next journey awaits</h3>
              <p>Choose your stops and date to view bus schedules.</p>
            </div>
          )}

          {searching && (
            <div className="empty-state">
              <p>Looking for buses...</p>
            </div>
          )}

          {searched && trips.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">⌕</div>
              <h3>No buses found</h3>
              <p>
                No matching trips were found. Try another date or route,
                or check whether the admin has added a trip.
              </p>
            </div>
          )}

          <div className="trip-list">
            {trips.map((trip) => (
              <article className="trip-card" key={trip.tripId}>
                <div className="trip-top">
                  <div>
                    <span className="bus-type">
                      {trip.bus.busType.replace("_", " ")}
                    </span>
                    <h3>{trip.bus.registrationNumber}</h3>
                    <p className="route-name">{trip.routeName}</p>
                  </div>

                  <div className="fare">
                    <span>Full route fare</span>
                    <strong>
                      Rs. {Number(trip.fullRouteFare).toLocaleString("en-LK")}
                    </strong>
                  </div>
                </div>

                <div className="journey-times">
                  <div>
                    <span className="time">
                      {formatTime(trip.from.departureTime)}
                    </span>
                    <strong>{getStopName(trip.from.stopCode)}</strong>
                    <span className="time-label">Departure</span>
                  </div>

                  <div className="journey-line">
                    <span />
                    <div />
                    <span />
                  </div>

                  <div className="destination-time">
                    <span className="time">
                      {formatTime(trip.to.arrivalTime)}
                    </span>
                    <strong>{getStopName(trip.to.stopCode)}</strong>
                    <span className="time-label">Arrival</span>
                  </div>
                </div>

                <div className="trip-bottom">
                  <span className="status">
                    <span className="status-dot" />
                    {trip.status.replace("_", " ")}
                  </span>

                  <button
                    className="book-button"
                    onClick={() =>
                      alert(
                        "Booking will be implemented in the next milestone."
                      )
                    }
                  >
                    Book this bus
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand footer-brand" href="/">
          <span className="brand-icon">B</span>
          <span>BusGo</span>
        </a>
        <p>Making every journey a little easier.</p>
        <span>BusGo · Learning project</span>
      </footer>
    </div>
  );
}

export default App;
