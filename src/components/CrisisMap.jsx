import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';

const defaultCenter = [40.7128, -74.006];

function urgencyRadius(urgency) {
  if (urgency === 'Critical') return 36;
  if (urgency === 'High') return 28;
  if (urgency === 'Medium') return 20;
  return 14;
}

function urgencyColor(urgency) {
  if (urgency === 'Critical') return '#ff3b30';
  if (urgency === 'High') return '#ff9500';
  if (urgency === 'Medium') return '#00f0ff';
  return '#8a2be2';
}

export default function CrisisMap({ tasks }) {
  const positionedTasks = tasks.filter((task) => task.coordinates?.lat && task.coordinates?.lng);

  return (
    <div className="glass-panel" style={{ padding: '1rem', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem' }}>
        <div>
          <h3>Crisis Heatmap</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>Live clusters of active needs, simulated locally with Leaflet for demo use.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {['Critical', 'High', 'Medium', 'Low'].map((level) => (
            <span
              key={level}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.7rem',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
                fontSize: '0.8rem'
              }}
            >
              <span style={{ width: '0.65rem', height: '0.65rem', borderRadius: '50%', background: urgencyColor(level) }} />
              {level}
            </span>
          ))}
        </div>
      </div>

      <div style={{ height: '320px', borderRadius: '18px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
        <MapContainer center={defaultCenter} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {positionedTasks.map((task) => (
            <CircleMarker
              key={task.id}
              center={[task.coordinates.lat, task.coordinates.lng]}
              radius={urgencyRadius(task.urgency)}
              pathOptions={{
                color: urgencyColor(task.urgency),
                fillColor: urgencyColor(task.urgency),
                fillOpacity: 0.28
              }}
            >
              <Popup>
                <strong>{task.translatedTitle || task.title}</strong>
                <br />
                {task.location}
                <br />
                {task.translatedCategory || task.category} • {task.translatedUrgency || task.urgency}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
