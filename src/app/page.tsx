'use client';

import { useState, useEffect } from 'react';
import { Event } from '@/lib/supabase';
import CreateEventModal from '@/components/CreateEventModal';

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const res = await fetch('/api/events');
      const json = await res.json();
      if (res.ok) setEvents(json.data || []);
    } finally {
      setLoading(false);
    }
  }

  function handleCreated(event: Event) {
    setEvents(prev => [event, ...prev]);
    setShowModal(false);
  }

  return (
    <main>
      <div className="hero">
        <div className="container">
          <div className="hero-badge">
            <span>✨</span> AI-powered with Gemini Vision
          </div>
          <h1 className="hero-title">
            Scan Cards.<br />Never Miss a Lead.
          </h1>
          <p className="hero-desc">
            Scan any business card at any event. AI extracts the details instantly. Everything syncs to your database — ready to use.
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => setShowModal(true)}
            id="btn-create-event-hero"
          >
            🎪 Create Your First Event
          </button>
        </div>
      </div>

      <div className="container">
        <div className="events-header">
          <div>
            <div className="section-label">Your Events</div>
            <div className="section-title">All Events</div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} id="btn-new-event">
            + New Event
          </button>
        </div>

        {loading ? (
          <div className="events-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="card">
                <div className="skeleton" style={{ height: 48, width: 48, borderRadius: 12, marginBottom: 16 }} />
                <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 14, width: '40%' }} />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🎪</span>
            <div className="empty-title">No events yet</div>
            <div className="empty-desc">Create your first event to start scanning business cards</div>
            <br />
            <button className="btn btn-primary" onClick={() => setShowModal(true)} id="btn-create-first">
              + Create Event
            </button>
          </div>
        ) : (
          <div className="events-grid">
            {events.map(event => (
              <a key={event.id} href={`/events/${event.id}`} className="card card-clickable" style={{ textDecoration: 'none' }}>
                <div className="event-card-inner">
                  <div className="event-icon">🎪</div>
                  <div className="event-name">{event.name}</div>
                  <div className="event-meta">
                    {event.date && (
                      <div className="event-meta-item">
                        <span>📅</span>
                        {new Date(event.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {event.location && (
                      <div className="event-meta-item">
                        <span>📍</span> {event.location}
                      </div>
                    )}
                  </div>
                  <div className="event-contacts-count">
                    <span>👥</span> View Contacts →
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <CreateEventModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </main>
  );
}
