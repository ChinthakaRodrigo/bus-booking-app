# BusGo

BusGo is a bus reservation app with separate passenger, administrator, and driver experiences. It uses a React/Vite client, an Express API, and MongoDB.

## Run locally

1. Install dependencies in both applications:

   ```powershell
   cd server
   npm install
   cd ..\client
   npm install
   ```

2. Create `server/.env` with:

   ```dotenv
   MONGODB_URI=mongodb://127.0.0.1:27017/busgo
   JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
   PORT=5000
   ADMIN_NAME=BusGo Administrator
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=replace-with-a-strong-password
   ```

   MongoDB must be running and `JWT_SECRET` must contain at least 32 characters. On startup, the server creates this administrator account if it does not already exist. Keep these credentials private.

3. Start the server and client in separate PowerShell terminals:

   ```powershell
   cd server
   npm run dev
   ```

   ```powershell
   cd client
   npm run dev
   ```

   The API defaults to `http://localhost:5000/api`. To use another API base URL, set `VITE_API_URL` in the client environment (include `/api`, with no trailing slash).

## Roles and features

- **User:** register and sign in, search available trips by stops/date, reserve seats, view or cancel bookings, and see driver-reported stop locations. New public registrations are always users.
- **Admin:** sign in with the bootstrapped account, create buses and ordered routes, create driver accounts, and schedule trips with a bus, route, driver, fare, and time range.
- **Driver:** sign in with an account created by an admin, view assigned trips, update the current route stop, and mark trips completed.

Driver accounts and trip assignments are managed by an administrator. A driver's reported stop is visible in passenger trip search results and refreshes automatically while the results page is open.
