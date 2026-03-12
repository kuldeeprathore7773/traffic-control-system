import React, { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

const JAIPUR_CENTER = [26.9124, 75.7873];

const DEFAULT_PARKING_LOTS = [
  {
    id: 'parking-1',
    name: 'MI Road Parking',
    coords: [26.9155, 75.8113],
    type: 'Public Parking',
    capacity: 'Large',
  },
  {
    id: 'parking-2',
    name: 'Badi Chaupar Multi-level Parking',
    coords: [26.9234, 75.8261],
    type: 'Multi-level',
    capacity: 'Medium',
  },
  {
    id: 'parking-3',
    name: 'Civil Lines Metro Parking',
    coords: [26.9029, 75.7878],
    type: 'Metro Parking',
    capacity: 'Medium',
  },
  {
    id: 'parking-4',
    name: 'Gandhinagar Station Parking',
    coords: [26.8841, 75.8135],
    type: 'Railway Parking',
    capacity: 'Large',
  },
];

// Fix default Leaflet marker icons in CRA
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const barricadeIcon = L.divIcon({
  className: '',
  html:
    '<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;background:rgba(248,113,113,0.92);box-shadow:0 0 0 2px rgba(127,29,29,0.9);font-size:14px;">🚧</div>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const parkingIcon = L.divIcon({
  className: '',
  html:
    '<div style="display:flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:6px;background:rgba(37,99,235,0.96);box-shadow:0 0 0 2px rgba(15,23,42,0.9);font-size:13px;color:#e5e7eb;font-weight:700;">P</div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

function MapInteraction({
  mode,
  role,
  onAddPointToClosure,
  onAddAltRoutePoint,
  onSetSource,
  onSetDestination,
  onSetParkingPoint,
}) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      if (role === 'admin' && mode === 'closure') {
        onAddPointToClosure([lat, lng]);
      } else if (role === 'admin' && mode === 'altRoute') {
        onAddAltRoutePoint([lat, lng]);
      } else if (role === 'admin' && mode === 'parking') {
        onSetParkingPoint([lat, lng]);
      } else if (mode === 'source') {
        onSetSource([lat, lng]);
      } else if (mode === 'destination') {
        onSetDestination([lat, lng]);
      }
    },
  });
  return null;
}

function App() {
  const initialIsAdminRoute =
    typeof window !== 'undefined' &&
    window.location &&
    window.location.pathname.startsWith('/admin');

  // Simple routing: /admin = always admin mode, no popup/password
  const [role, setRole] = useState(initialIsAdminRoute ? 'admin' : 'public'); // 'public' | 'admin'
  const [adminLoggedIn, setAdminLoggedIn] = useState(initialIsAdminRoute);

  const [interactionMode, setInteractionMode] = useState(
    initialIsAdminRoute ? 'closure' : 'source',
  ); // closure | source | destination | parking
  const [currentClosurePoints, setCurrentClosurePoints] = useState([]);
  const [closures, setClosures] = useState([]);
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRouting, setIsRouting] = useState(false);
  const [showParking, setShowParking] = useState(false);
  const [nearbyParking, setNearbyParking] = useState([]);
  const [parkings, setParkings] = useState(DEFAULT_PARKING_LOTS);
  const [pendingParkingPoint, setPendingParkingPoint] = useState(null);
  const [pendingParkingName, setPendingParkingName] = useState('');
  const [pendingParkingType, setPendingParkingType] = useState('Public Parking');
  const [pendingParkingCapacity, setPendingParkingCapacity] = useState('Medium');
   const [currentAdminRoutePoints, setCurrentAdminRoutePoints] = useState([]);
  const [adminRoute, setAdminRoute] = useState(null);

  // Load closures from backend on mount
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch('/api/closures');
        if (!res.ok) {
          throw new Error('failed');
        }
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) {
          setClosures(data);
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('jaipur-closures', JSON.stringify(data));
          }
        }
      } catch {
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem('jaipur-closures');
          if (cached && !cancelled) {
            try {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed)) {
                setClosures(parsed);
              }
            } catch {
              // ignore bad cache
            }
          }
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  // Load admin-defined parkings from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = window.localStorage.getItem('jaipur-parkings');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setParkings(parsed);
        }
      } catch {
        // ignore bad cache
      }
    }
  }, []);

  // Load saved admin alternate route from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = window.localStorage.getItem('jaipur-admin-route');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 1) {
          setAdminRoute(parsed);
        }
      } catch {
        // ignore bad cache
      }
    }
  }, []);

  const handleAddClosurePoint = (latlng) => {
    setCurrentClosurePoints((prev) => [...prev, latlng]);
  };

  const handleCommitClosure = async () => {
    if (currentClosurePoints.length < 2) return;
    const newClosures = [
      ...closures,
      {
        id: Date.now().toString(),
        coordinates: currentClosurePoints,
        status: 'closed',
        label: `Segment #${closures.length + 1}`,
      },
    ];
    setClosures(newClosures);
    setCurrentClosurePoints([]);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'jaipur-closures',
        JSON.stringify(newClosures),
      );
    }

    setIsSaving(true);
    try {
      await fetch('/api/closures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: newClosures }),
      });
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearTempClosure = () => {
    setCurrentClosurePoints([]);
  };

  const canRoute =
    role === 'public' ? !!destination : Boolean(source && destination);

  const handleComputeRoute = async () => {
    // PUBLIC: auto-pick current location as source if missing
    let effectiveSource = source;
    if (role === 'public' && !effectiveSource) {
      if (!destination) {
        alert('Please tap on the map to choose your destination first.');
        return;
      }
      if (!navigator.geolocation) {
        alert(
          'Location access is not available. Please tap on the map to set Source and Destination.',
        );
        return;
      }
      try {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
          });
        });
        effectiveSource = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setSource(effectiveSource);
      } catch {
        alert(
          'Could not access your current location. Please tap on the map to set Source manually.',
        );
        return;
      }
    }

    if (!effectiveSource || !destination) {
      alert('Please set both Source and Destination on the map.');
      return;
    }

    setIsRouting(true);
    try {
      // If an admin has published a manual safe route, prefer it
      if (adminRoute && adminRoute.length > 1) {
        setRoute(adminRoute);
        setIsRouting(false);
        return;
      }

      const res = await fetch('/api/route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ source: effectiveSource, destination }),
      });
      if (!res.ok) {
        setRoute([effectiveSource, destination]); // fallback straight line
        return;
      }
      const data = await res.json();
      if (Array.isArray(data.route) && data.route.length > 0) {
        setRoute(data.route);
      } else {
        setRoute([effectiveSource, destination]);
      }
    } finally {
      setIsRouting(false);
    }
  };

  const handleResetRoute = () => {
    setSource(null);
    setDestination(null);
    setRoute(null);
    setInteractionMode(role === 'admin' ? 'closure' : 'source');
  };

  const handleAdminLogout = () => {
    setAdminLoggedIn(false);
    setRole('public');
    setInteractionMode('source');
  };

  const computeNearbyParking = () => {
    if (!destination) {
      setNearbyParking(parkings);
      setShowParking(true);
      return;
    }
    const [dLat, dLng] = destination;
    const withDistance = parkings.map((p) => {
      const [pLat, pLng] = p.coords;
      const d =
        Math.sqrt((dLat - pLat) ** 2 + (dLng - pLng) ** 2) * 111; // approx km
      return { ...p, distanceKm: d };
    });
    withDistance.sort((a, b) => a.distanceKm - b.distanceKm);
    setNearbyParking(withDistance.slice(0, 3));
    setShowParking(true);
  };

  const handleOpenClosure = async (id) => {
    const updated = closures.filter((c) => c.id !== id);
    setClosures(updated);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('jaipur-closures', JSON.stringify(updated));
    }
    try {
      await fetch('/api/closures', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: updated }),
      });
    } catch {
      // ignore network issues; local state already updated
    }
  };

  const handleSaveParking = () => {
    if (!pendingParkingPoint || !pendingParkingName.trim()) return;
    const newParking = {
      id: `parking-${Date.now()}`,
      name: pendingParkingName.trim(),
      coords: pendingParkingPoint,
      type: pendingParkingType,
      capacity: pendingParkingCapacity,
    };
    const updated = [...parkings, newParking];
    setParkings(updated);
    setPendingParkingPoint(null);
    setPendingParkingName('');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('jaipur-parkings', JSON.stringify(updated));
    }
  };

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-left">
          <div>
            <div className="app-title">Jaipur Traffic Command</div>
            <div className="app-subtitle">
              Event diversions · VIP movement · Rally control
            </div>
          </div>
        </div>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
        >
          {adminLoggedIn && <div className="badge">Admin console</div>}
          <div className="status-indicator">
            <span className="status-dot" />
            {adminLoggedIn ? 'Admin dashboard' : 'Citizen view'}
          </div>
        </div>
      </header>

      <main className="app-main">
        <section className="map-container">
          <MapContainer
            center={JAIPUR_CENTER}
            zoom={13}
            scrollWheelZoom
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapInteraction
              mode={interactionMode}
              role={role}
              onAddPointToClosure={handleAddClosurePoint}
              onAddAltRoutePoint={(latlng) =>
                setCurrentAdminRoutePoints((prev) => [...prev, latlng])
              }
              onSetSource={setSource}
              onSetDestination={setDestination}
              onSetParkingPoint={setPendingParkingPoint}
            />

            {closures.map((closure) => (
              <React.Fragment key={closure.id}>
                <Polyline
                  positions={closure.coordinates}
                  pathOptions={{ color: '#ef4444', weight: 5 }}
                />
                {closure.coordinates.length > 0 && (
                  <Marker
                    position={
                      closure.coordinates[
                        Math.floor(closure.coordinates.length / 2)
                      ]
                    }
                    icon={barricadeIcon}
                  />
                )}
              </React.Fragment>
            ))}

            {currentClosurePoints.length > 0 && (
              <Polyline
                positions={currentClosurePoints}
                pathOptions={{
                  color: '#f97316',
                  dashArray: '6 6',
                  weight: 4,
                }}
              />
            )}

            {currentAdminRoutePoints.length > 1 && (
              <Polyline
                positions={currentAdminRoutePoints}
                pathOptions={{
                  color: '#4ade80',
                  dashArray: '4 6',
                  weight: 4,
                }}
              />
            )}

            {route && (
              <Polyline
                positions={route}
                pathOptions={{ color: '#22c55e', weight: 5 }}
              />
            )}

            {source && <Marker position={source} />}
            {destination && <Marker position={destination} />}

            {parkings.map((p) => (
              <Marker key={p.id} position={p.coords} icon={parkingIcon} />
            ))}
          </MapContainer>

          <div className="map-legend">
            <div className="map-legend-row">
              <span className="legend-line red" />
              बंद मार्ग (Closed)
            </div>
            <div className="map-legend-row">
              <span className="legend-line yellow" />
              अस्थायी अवरोध (Temp block)
            </div>
            <div className="map-legend-row">
              <span className="legend-line green" />
              वैकल्पिक मार्ग (Route)
            </div>
          </div>

          <div className="map-help">
            {interactionMode === 'closure' &&
              'Click map to sketch closed road · Press "Save closed segment"'}
            {interactionMode === 'source' &&
              'Click map to set source point'}
            {interactionMode === 'destination' &&
              'Click map to set destination point'}
          </div>
        </section>

        <aside className="sidebar">
          {role === 'admin' && (
            <>
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <div className="panel-title-icon">🚦</div>
                    <span>Traffic Control Dashboard</span>
                  </div>
                  <span className="panel-subtitle">
                    Logged in as control room
                  </span>
                </div>

                <div className="field-group">
                  <div className="field-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setInteractionMode('closure')}
                      style={{
                        flex: 1,
                        borderColor:
                          interactionMode === 'closure'
                            ? 'rgba(52, 211, 153, 0.9)'
                            : undefined,
                      }}
                    >
                      Draw Closed Road
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setInteractionMode('source')}
                      style={{
                        flex: 1,
                        borderColor:
                          interactionMode === 'source'
                            ? 'rgba(96, 165, 250, 0.9)'
                            : undefined,
                      }}
                    >
                      Source
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setInteractionMode('destination')}
                      style={{
                        flex: 1,
                        borderColor:
                          interactionMode === 'destination'
                            ? 'rgba(96, 165, 250, 0.9)'
                            : undefined,
                      }}
                    >
                      Destination
                    </button>
                  </div>

                  <div className="field-hint">
                    Use the map to sketch diversions around VIP routes / rallies.
                  </div>

                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleCommitClosure}
                      disabled={currentClosurePoints.length < 2 || isSaving}
                    >
                      {isSaving ? 'Saving…' : 'Save closed segment'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleClearTempClosure}
                      disabled={currentClosurePoints.length === 0}
                    >
                      Clear sketch
                    </button>
                  </div>
                </div>

                <ul className="list">
                  {closures.map((c) => (
                    <li key={c.id} className="list-item">
                      <div className="list-item-main">
                        <div className="list-item-title">{c.label}</div>
                        <div className="list-item-meta">
                          {c.coordinates.length} points · Status:{' '}
                          {c.status === 'closed' ? 'Closed' : c.status}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn-secondary"
                        style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => handleOpenClosure(c.id)}
                      >
                        Open
                      </button>
                    </li>
                  ))}
                  {closures.length === 0 && (
                    <li className="list-item">
                      <div className="list-item-main">
                        <div className="list-item-title">No diversions set</div>
                        <div className="list-item-meta">
                          Use the map to sketch rally / VIP diversions.
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <div className="panel-title-icon">🧭</div>
                    <span>Admin Safe Route</span>
                  </div>
                  <span className="panel-subtitle">
                    Draw highlighted green corridor
                  </span>
                </div>

                <div className="field-group">
                  <div className="field-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setInteractionMode('altRoute')}
                      style={{
                        flex: 1,
                        borderColor:
                          interactionMode === 'altRoute'
                            ? 'rgba(34,197,94,0.9)'
                            : undefined,
                      }}
                    >
                      Draw safe route
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setCurrentAdminRoutePoints([]);
                        setAdminRoute(null);
                        if (typeof window !== 'undefined') {
                          window.localStorage.removeItem('jaipur-admin-route');
                        }
                      }}
                    >
                      Clear
                    </button>
                  </div>

                  <div className="field-hint">
                    Click along the map to draw the preferred green corridor
                    that citizens should follow.
                  </div>

                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={currentAdminRoutePoints.length < 2}
                      onClick={() => {
                        setAdminRoute(currentAdminRoutePoints);
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem(
                            'jaipur-admin-route',
                            JSON.stringify(currentAdminRoutePoints),
                          );
                        }
                        setCurrentAdminRoutePoints([]);
                      }}
                    >
                      Save safe route
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <div className="panel-title-icon">👤</div>
                    <span>Admin Session</span>
                  </div>
                  <span className="panel-subtitle">Control room operator</span>
                </div>

                <div className="field-group">
                  <div className="pill-row">
                    <span className="pill">
                      Total active diversions: {closures.length}
                    </span>
                    <span className="pill">Jaipur city mode: LIVE</span>
                  </div>

                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleAdminLogout}
                    >
                      Log out
                    </button>
                  </div>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <div className="panel-title-icon">🅿️</div>
                    <span>Define Parking</span>
                  </div>
                  <span className="panel-subtitle">Admin-only parking spots</span>
                </div>

                <div className="field-group">
                  <div className="field-row">
                    <div className="field">
                      <span className="field-label">Location on map</span>
                      <div className="field-hint">
                        Switch to parking mode and click on the map to pick a
                        parking point.
                      </div>
                    </div>
                  </div>

                  <div className="field-row">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setInteractionMode('parking')}
                      style={{
                        flex: 1,
                        borderColor:
                          interactionMode === 'parking'
                            ? 'rgba(96, 165, 250, 0.9)'
                            : undefined,
                      }}
                    >
                      Pick on map
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setInteractionMode('closure')}
                    >
                      Back to roads
                    </button>
                  </div>

                  <div className="field">
                    <span className="field-label">Parking name</span>
                    <input
                      type="text"
                      placeholder="e.g. Stadium Event Parking"
                      value={pendingParkingName}
                      onChange={(e) => setPendingParkingName(e.target.value)}
                    />
                  </div>

                  <div className="field-row">
                    <div className="field">
                      <span className="field-label">Type</span>
                      <select
                        value={pendingParkingType}
                        onChange={(e) => setPendingParkingType(e.target.value)}
                      >
                        <option>Public Parking</option>
                        <option>Event Parking</option>
                        <option>Multi-level</option>
                        <option>Metro Parking</option>
                        <option>Railway Parking</option>
                      </select>
                    </div>
                    <div className="field">
                      <span className="field-label">Capacity</span>
                      <select
                        value={pendingParkingCapacity}
                        onChange={(e) =>
                          setPendingParkingCapacity(e.target.value)
                        }
                      >
                        <option>Small</option>
                        <option>Medium</option>
                        <option>Large</option>
                      </select>
                    </div>
                  </div>

                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!pendingParkingPoint || !pendingParkingName}
                      onClick={handleSaveParking}
                    >
                      Save parking
                    </button>
                  </div>
                </div>

                <ul className="parking-list">
                  {parkings.map((p) => (
                    <li key={p.id} className="parking-item">
                      <div className="parking-item-main">
                        <div className="parking-item-title">{p.name}</div>
                        <div className="parking-item-meta">
                          {p.type} · {p.capacity} capacity
                        </div>
                      </div>
                      <span className="parking-badge">Parking</span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          {role === 'public' && (
            <>
              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <div className="panel-title-icon">🧭</div>
                    <span>Citizen Route Advisor</span>
                  </div>
                  <span className="panel-subtitle">
                    जन मार्गदर्शन (Jaipur)
                  </span>
                </div>

                <div className="field-group">
                  <div className="field-row">
                    <div className="field">
                      <span className="field-label">Source (मानचित्र से)</span>
                      <div className="field-hint">
                        Tap on map in <strong>Source</strong> mode
                      </div>
                    </div>
                    <div className="field">
                      <span className="field-label">
                        Destination (मानचित्र से)
                      </span>
                      <div className="field-hint">
                        Tap on map in <strong>Destination</strong> mode
                      </div>
                    </div>
                  </div>

                  <div className="chip-row">
                    <span className="chip">
                      <span className="chip-dot red" /> Closed for rally
                    </span>
                    <span className="chip">
                      <span className="chip-dot yellow" /> VIP movement corridor
                    </span>
                    <span className="chip">
                      <span className="chip-dot green" /> Suggested route
                    </span>
                  </div>

                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={handleComputeRoute}
                      disabled={!canRoute || isRouting}
                    >
                      {isRouting ? 'Computing…' : 'Get safe alternate route'}
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleResetRoute}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                <ul className="list">
                  {closures.map((c) => (
                    <li key={c.id} className="list-item">
                      <div className="list-item-main">
                        <div className="list-item-title">{c.label}</div>
                        <div className="list-item-meta">
                          बंद मार्ग · {c.coordinates.length} points
                        </div>
                      </div>
                      <span className="list-item-badge">Avoid</span>
                    </li>
                  ))}
                  {closures.length === 0 && (
                    <li className="list-item">
                      <div className="list-item-main">
                        <div className="list-item-title">
                          No closures reported
                        </div>
                        <div className="list-item-meta">
                          All main corridors are currently open.
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <div className="panel-title-icon">🅿️</div>
                    <span>Nearby Parking</span>
                  </div>
                  <span className="panel-subtitle">
                    पार्किंग खोजें (Jaipur)
                  </span>
                </div>

                <div className="field-group">
                  <div className="field-hint">
                    Set your destination on the map, then find organised parking
                    around that area.
                  </div>
                  <div className="btn-row">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={computeNearbyParking}
                    >
                      Find parking near destination
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setShowParking(false);
                        setNearbyParking([]);
                      }}
                    >
                      Hide
                    </button>
                  </div>
                </div>

                <ul className="parking-list">
                  {(nearbyParking.length > 0 ? nearbyParking : parkings).map(
                    (p) => (
                      <li key={p.id} className="parking-item">
                        <div className="parking-item-main">
                          <div className="parking-item-title">{p.name}</div>
                          <div className="parking-item-meta">
                            {p.type} · {p.capacity} capacity
                            {p.distanceKm != null
                              ? ` · ~${p.distanceKm.toFixed(
                                  1,
                                )} km from destination`
                              : ''}
                          </div>
                        </div>
                        <span className="parking-badge">Parking</span>
                      </li>
                    ),
                  )}
                </ul>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <div className="panel-title-icon">🆘</div>
                    <span>SOS सहायता</span>
                  </div>
                  <span className="panel-subtitle">
                    कन्ट्रोल रूम से तत्काल संपर्क
                  </span>
                </div>

                <button type="button" className="btn-sos">
                  <span className="icon">🚨</span> Send SOS to Control Room
                </button>

                <p
                  style={{
                    marginTop: '0.55rem',
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    lineHeight: 1.5,
                  }}
                >
                  In production this will share your live location and traffic
                  issue with Jaipur traffic police control room, similar to the
                  SOS flow on Shyam Sarthi.
                </p>
              </section>
            </>
          )}
        </aside>
      </main>

    </div>
  );
}

export default App;

