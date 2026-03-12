const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 5000;
const ORS_API_KEY = process.env.ORS_API_KEY;

app.use(cors());
app.use(express.json());

// In-memory store for road closures (prototype only)
let closures = [];

// Get all active closures
app.get('/api/closures', (req, res) => {
  res.json(closures);
});

// Create or update closures (simple replace-all for prototype)
app.post('/api/closures', (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'items must be an array' });
  }
  closures = items;
  res.json({ ok: true, count: closures.length });
});

// Compute route using OpenRouteService, avoiding closed segments (approx)
app.post('/api/route', async (req, res) => {
  if (!ORS_API_KEY) {
    return res.status(500).json({ error: 'ORS_API_KEY not configured on server' });
  }

  const { source, destination } = req.body;
  if (
    !Array.isArray(source) ||
    !Array.isArray(destination) ||
    source.length !== 2 ||
    destination.length !== 2
  ) {
    return res.status(400).json({ error: 'source and destination must be [lat, lng]' });
  }

  // ORS expects [lng, lat]
  const start = [source[1], source[0]];
  const end = [destination[1], destination[0]];

  // Approximate closures as avoid_points (can be upgraded to polygons later)
  const avoidPoints = closures.flatMap((c) =>
    (c.coordinates || []).map(([lat, lng]) => [lng, lat])
  );

  try {
    const body = {
      coordinates: [start, end],
      instructions: false,
    };

    if (avoidPoints.length > 0) {
      body.options = {
        avoid_polygons: {
          type: 'MultiPoint',
          coordinates: avoidPoints,
        },
      };
    }

    const orsRes = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
      method: 'POST',
      headers: {
        'Authorization': ORS_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!orsRes.ok) {
      const text = await orsRes.text();
      return res.status(502).json({ error: 'OpenRouteService error', details: text });
    }

    const data = await orsRes.json();
    const coordinates = data.features?.[0]?.geometry?.coordinates || [];

    // Convert back to [lat, lng] for Leaflet
    const latlngs = coordinates.map(([lng, lat]) => [lat, lng]);

    res.json({ route: latlngs });
  } catch (err) {
    console.error('Route error', err);
    res.status(500).json({ error: 'Failed to compute route' });
  }
});

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Traffic control API listening on port ${PORT}`);
});

