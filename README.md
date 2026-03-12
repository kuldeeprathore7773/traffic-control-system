## Jaipur Traffic Control System (React + Node)

This app is a prototype for managing traffic diversions in Jaipur during government / public events such as political rallies and VIP movement.

It is visually inspired by the SOS and route experience on [`shyamsarathi.com/route.html`](https://shyamsarathi.com/route.html) but focused on **Jaipur traffic diversion control**.

### Features

- **Live Jaipur map** using OpenStreetMap + Leaflet.
- **Hidden admin diversion editor (dashboard)**: login-only panel (opened via keyboard) to sketch and save closed road segments for rallies / VIP corridors.
- **Public citizen view**: users can see closed roads, request a safe alternate route and discover nearby organised parking.
- **Basic SOS panel** inspired by [`shyamsarathi.com/route.html`](https://shyamsarathi.com/route.html) for contacting control room (UI only in this prototype).
- **Simple Node/Express backend** that stores closures in memory (`/server/index.js`) and calls OpenRouteService for routing.

### Getting started

1. Install dependencies (from the project root):

```bash
npm install
```

2. Start backend + frontend together:

```bash
npm run dev
```

- React frontend: `http://localhost:3000`
- Node API: `http://localhost:5000` (proxied from the frontend as `/api/...`)

### Configure real routing (OpenRouteService)

This project is wired to use **OpenRouteService** for real car routing that avoids closed segments.

1. Create a free account and API key at [`openrouteservice.org`](https://openrouteservice.org/).
2. Set the key in your environment before starting the server (PowerShell example):

```powershell
$env:ORS_API_KEY="YOUR_API_KEY_HERE"
npm run dev
```

or for a single server run:

```powershell
$env:ORS_API_KEY="YOUR_API_KEY_HERE"
npm run server
```

When configured, the frontend route button will call `POST /api/route`, which:

- Sends source + destination to OpenRouteService.
- Asks it to avoid the currently configured closed segments.
- Returns a polyline that is rendered as a green route on the Jaipur map.

### How to use – admin dashboard (control room)

- The admin console is **not visible in the normal UI**.
- To access it, open `http://localhost:3000/admin` in your browser.
- The login dialog will appear automatically – enter the demo password: **`admin123`**.
- In the **Traffic Control Dashboard**:
  - Choose **Draw Closed Road** and click multiple times on the map to sketch a diversion, then press **Save closed segment**.
  - Switch to **Source / Destination** if you want to quickly simulate a route that citizens will see.
- Saved diversions appear as red segments and are stored in the backend for public users to avoid.

### How to use – public citizen view

- By default the app is in **public view** – there is no admin toggle visible.
- Use **Source** and **Destination** modes on the map to select your trip.
- Press **Get safe alternate route** to see a green route that avoids closed segments configured by the admin.
- The **Nearby Parking** panel:
  - Press **Find parking near destination** to list and highlight a few curated parking locations close to your destination in Jaipur.
  - Parking markers are shown on the map along with the route.
- Use the **SOS सहायता** panel as the conceptual place where, in production, a user would raise a traffic SOS to the control room.

