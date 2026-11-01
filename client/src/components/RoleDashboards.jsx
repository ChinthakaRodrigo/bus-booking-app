import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../services/api";
import "./RoleDashboards.css";

function DashboardHeader({ user, onLogout }) {
  return (
    <header className="ops-header">
      <a className="brand" href="/">
        <span className="brand-icon">B</span>
        <span>BusGo</span>
      </a>
      <div className="ops-user">
        <span>{user.name} · {user.role.toLowerCase()}</span>
        <button className="nav-button" type="button" onClick={onLogout}>Log out</button>
      </div>
    </header>
  );
}

function StatusMessage({ error, success }) {
  if (error) return <p className="ops-message error-message">{error}</p>;
  if (success) return <p className="ops-message success-message">{success}</p>;
  return null;
}

export function AdminDashboard({ user, token, onLogout }) {
  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [trips, setTrips] = useState([]);
  const [busForm, setBusForm] = useState({ registrationNumber: "", busType: "NORMAL", capacity: "40" });
  const [routeForm, setRouteForm] = useState({ routeName: "", stops: "" });
  const [driverForm, setDriverForm] = useState({ name: "", email: "", password: "" });
  const [tripForm, setTripForm] = useState({
    bus: "", route: "", driver: "", departureTime: "", arrivalTime: "", fare: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [busData, routeData, driverData, tripData] = await Promise.all([
        apiRequest("/buses"),
        apiRequest("/routes"),
        apiRequest("/users/drivers", { token }),
        apiRequest("/trips"),
      ]);
      setBuses(busData);
      setRoutes(routeData);
      setDrivers(driverData);
      setTrips(tripData);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest("/buses"),
      apiRequest("/routes"),
      apiRequest("/users/drivers", { token }),
      apiRequest("/trips"),
    ])
      .then(([busData, routeData, driverData, tripData]) => {
        if (!active) return;
        setBuses(busData);
        setRoutes(routeData);
        setDrivers(driverData);
        setTrips(tripData);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submitRequest(event, path, body, message, reset) {
    event.preventDefault();
    setError("");
    setSuccess("");
    try {
      await apiRequest(path, { method: "POST", token, body: JSON.stringify(body) });
      setSuccess(message);
      reset();
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function createBus(event) {
    return submitRequest(event, "/buses", {
      ...busForm,
      capacity: Number(busForm.capacity),
    }, "Bus added.", () => setBusForm({ registrationNumber: "", busType: "NORMAL", capacity: "40" }));
  }

  function createRoute(event) {
    event.preventDefault();
    const stops = routeForm.stops.split(/\r?\n/).map((line, index) => {
      const [stopCode, ...nameParts] = line.split(",");
      return { stopCode: stopCode.trim().toUpperCase(), name: nameParts.join(",").trim(), order: index + 1 };
    });
    if (stops.some((stop) => !stop.stopCode || !stop.name)) {
      setError("Enter each stop on a new line in CODE, Stop name format.");
      return;
    }
    return submitRequest(event, "/routes", {
      routeName: routeForm.routeName.trim(),
      stops,
    }, "Route created.", () => setRouteForm({ routeName: "", stops: "" }));
  }

  function createDriver(event) {
    return submitRequest(event, "/users/drivers", driverForm, "Driver account created.", () =>
      setDriverForm({ name: "", email: "", password: "" })
    );
  }

  function createTrip(event) {
    const route = routes.find((item) => item._id === tripForm.route);
    const start = new Date(tripForm.departureTime);
    const finish = new Date(tripForm.arrivalTime);
    if (!route || Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime()) || finish <= start) {
      setError("Choose a route and an arrival time after departure.");
      event.preventDefault();
      return;
    }
    const step = (finish.getTime() - start.getTime()) / (route.stops.length - 1);
    const stopTimes = route.stops.map((stop, index) => {
      const time = (
        index === 0
          ? start
          : index === route.stops.length - 1
            ? finish
            : new Date(start.getTime() + step * index)
      ).toISOString();
      return {
        stopCode: stop.stopCode,
        arrivalTime: index === 0 ? null : time,
        departureTime: index === route.stops.length - 1 ? null : time,
      };
    });
    return submitRequest(event, "/trips", {
      bus: tripForm.bus,
      route: tripForm.route,
      driver: tripForm.driver,
      departureTime: start.toISOString(),
      arrivalTime: finish.toISOString(),
      fare: Number(tripForm.fare),
      stopTimes,
    }, "Trip scheduled.", () => setTripForm({
      bus: "", route: "", driver: "", departureTime: "", arrivalTime: "", fare: "",
    }));
  }

  return (
    <div className="ops-page">
      <DashboardHeader user={user} onLogout={onLogout} />
      <main className="ops-main">
        <div className="ops-title">
          <div><span className="eyebrow">OPERATIONS</span><h1>Admin dashboard</h1></div>
          <p>Manage your fleet, routes, drivers, and scheduled trips.</p>
        </div>
        <StatusMessage error={error} success={success} />

        <div className="ops-stats">
          <div><strong>{buses.length}</strong><span>Buses</span></div>
          <div><strong>{routes.length}</strong><span>Routes</span></div>
          <div><strong>{drivers.length}</strong><span>Drivers</span></div>
          <div><strong>{trips.length}</strong><span>Trips</span></div>
        </div>

        <div className="ops-grid">
          <section className="ops-card">
            <h2>Add a bus</h2>
            <form onSubmit={createBus}>
              <label>Registration number<input required value={busForm.registrationNumber} onChange={(e) => setBusForm({ ...busForm, registrationNumber: e.target.value })} /></label>
              <label>Bus type<select value={busForm.busType} onChange={(e) => setBusForm({ ...busForm, busType: e.target.value })}><option value="NORMAL">Normal</option><option value="SEMI_LUXURY">Semi luxury</option><option value="LUXURY">Luxury</option></select></label>
              <label>Seat capacity<input type="number" min="1" required value={busForm.capacity} onChange={(e) => setBusForm({ ...busForm, capacity: e.target.value })} /></label>
              <button className="ops-submit" type="submit">Add bus</button>
            </form>
          </section>

          <section className="ops-card">
            <h2>Create a route</h2>
            <form onSubmit={createRoute}>
              <label>Route name<input required value={routeForm.routeName} onChange={(e) => setRouteForm({ ...routeForm, routeName: e.target.value })} /></label>
              <label>Stops <span className="field-hint">One per line: stop code, stop name</span><textarea required rows="5" placeholder={"COL, Colombo Fort\nKDY, Kandy"} value={routeForm.stops} onChange={(e) => setRouteForm({ ...routeForm, stops: e.target.value })} /></label>
              <button className="ops-submit" type="submit">Create route</button>
            </form>
          </section>

          <section className="ops-card">
            <h2>Add a driver</h2>
            <form onSubmit={createDriver}>
              <label>Full name<input required minLength="2" value={driverForm.name} onChange={(e) => setDriverForm({ ...driverForm, name: e.target.value })} /></label>
              <label>Email address<input type="email" required value={driverForm.email} onChange={(e) => setDriverForm({ ...driverForm, email: e.target.value })} /></label>
              <label>Initial password<input type="password" minLength="8" required value={driverForm.password} onChange={(e) => setDriverForm({ ...driverForm, password: e.target.value })} /></label>
              <button className="ops-submit" type="submit">Create driver account</button>
            </form>
          </section>

          <section className="ops-card">
            <h2>Schedule a trip</h2>
            {(!buses.length || !routes.length || !drivers.length) && <p className="field-hint">Add an active bus, route, and driver before scheduling.</p>}
            <form onSubmit={createTrip}>
              <label>Bus<select required value={tripForm.bus} onChange={(e) => setTripForm({ ...tripForm, bus: e.target.value })}><option value="">Select bus</option>{buses.filter((bus) => bus.status === "ACTIVE").map((bus) => <option key={bus._id} value={bus._id}>{bus.registrationNumber} · {bus.capacity} seats</option>)}</select></label>
              <label>Route<select required value={tripForm.route} onChange={(e) => setTripForm({ ...tripForm, route: e.target.value })}><option value="">Select route</option>{routes.filter((route) => route.status === "ACTIVE").map((route) => <option key={route._id} value={route._id}>{route.routeName}</option>)}</select></label>
              <label>Driver<select required value={tripForm.driver} onChange={(e) => setTripForm({ ...tripForm, driver: e.target.value })}><option value="">Assign driver</option>{drivers.map((driver) => <option key={driver._id} value={driver._id}>{driver.name}</option>)}</select></label>
              <label>Departure<input type="datetime-local" required value={tripForm.departureTime} onChange={(e) => setTripForm({ ...tripForm, departureTime: e.target.value })} /></label>
              <label>Arrival<input type="datetime-local" required value={tripForm.arrivalTime} onChange={(e) => setTripForm({ ...tripForm, arrivalTime: e.target.value })} /></label>
              <label>Full-route fare (Rs.)<input type="number" min="0" step="0.01" required value={tripForm.fare} onChange={(e) => setTripForm({ ...tripForm, fare: e.target.value })} /></label>
              <button className="ops-submit" type="submit" disabled={!buses.length || !routes.length || !drivers.length}>Schedule trip</button>
            </form>
          </section>
        </div>

        <section className="ops-card ops-trip-list">
          <div className="ops-list-heading"><h2>Scheduled trips</h2><button type="button" className="text-button" onClick={refresh}>Refresh</button></div>
          {loading ? <p>Loading trips...</p> : trips.length === 0 ? <p>No trips scheduled yet.</p> : (
            <div className="ops-table-wrap"><table><thead><tr><th>Route</th><th>Bus</th><th>Driver</th><th>Departure</th><th>Status</th></tr></thead><tbody>
              {trips.map((trip) => <tr key={trip._id}><td>{trip.route?.routeName || "—"}</td><td>{trip.bus?.registrationNumber || "—"}</td><td>{trip.driver?.name || "Unassigned"}</td><td>{new Date(trip.departureTime).toLocaleString()}</td><td>{trip.status.replaceAll("_", " ")}</td></tr>)}
            </tbody></table></div>
          )}
        </section>
      </main>
    </div>
  );
}

export function DriverDashboard({ user, token, onLogout }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      setTrips(await apiRequest("/trips/mine", { token }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let active = true;
    apiRequest("/trips/mine", { token })
      .then((data) => {
        if (active) setTrips(data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function updateTrip(trip, path, body) {
    setError("");
    try {
      await apiRequest(path, { method: "PATCH", token, body: JSON.stringify(body) });
      await refresh();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="ops-page">
      <DashboardHeader user={user} onLogout={onLogout} />
      <main className="ops-main">
        <div className="ops-title">
          <div><span className="eyebrow">DRIVER PORTAL</span><h1>Your trips</h1></div>
          <p>Report your current stop to share live trip progress with passengers.</p>
        </div>
        <StatusMessage error={error} />
        {loading ? <section className="ops-card">Loading assigned trips...</section> : trips.length === 0 ? (
          <section className="ops-card ops-empty"><h2>No trips assigned</h2><p>Ask an administrator to assign a trip to your account.</p></section>
        ) : (
          <div className="driver-trip-list">
            {trips.map((trip) => (
              <article className="ops-card driver-trip" key={trip._id}>
                <div className="driver-trip-heading"><div><span className="eyebrow">{trip.bus?.registrationNumber || "BUS"}</span><h2>{trip.route?.routeName || "Assigned trip"}</h2></div><span className={`trip-pill ${trip.status.toLowerCase()}`}>{trip.status.replaceAll("_", " ")}</span></div>
                <p><strong>Departure:</strong> {new Date(trip.departureTime).toLocaleString()}</p>
                <p><strong>Current stop:</strong> {trip.route?.stops?.find((stop) => stop.stopCode === trip.currentStopCode)?.name || "Not reported"}</p>
                {trip.status !== "COMPLETED" && trip.status !== "CANCELLED" && (
                  <div className="driver-controls">
                    <label>Update current stop<select defaultValue={trip.currentStopCode || ""} onChange={(event) => {
                      if (event.target.value) updateTrip(trip, `/trips/${trip._id}/location`, { stopCode: event.target.value });
                    }}><option value="">Choose a stop</option>{trip.route?.stops?.map((stop) => <option key={stop.stopCode} value={stop.stopCode}>{stop.name}</option>)}</select></label>
                    <button className="ops-submit" type="button" onClick={() => updateTrip(trip, `/trips/${trip._id}/status`, { status: "COMPLETED" })}>Complete trip</button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
