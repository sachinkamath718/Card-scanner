'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Event } from '@/lib/supabase';
import CreateEventModal from '@/components/CreateEventModal';

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

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

  async function handleDeleteEvent(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete event "${name}" and all its contacts? This cannot be undone.`)) return;
    setDeletingEventId(id);
    try {
      const res = await fetch(`/api/events?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEvents(prev => prev.filter(ev => ev.id !== id));
      toast.success(`Event "${name}" deleted`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeletingEventId(null);
    }
  }

  return (
    <main>
      <div className="hero">
        <div className="container">
          <div className="hero-badge">
            Smart Business Card Management
          </div>
          <h1 className="hero-title">
            Scan Cards.<br />Never Miss a Lead.
          </h1>
          <p className="hero-desc">
            Capture, manage and organise business cards from every event. Scan cards, QR codes, or upload images — contact details are extracted instantly and synced to your database.
          </p>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => setShowModal(true)}
            id="btn-create-event-hero"
          >
            Create Your First Event
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
            <div className="empty-icon-box">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2" />
                <line x1="2" y1="10" x2="22" y2="10" />
              </svg>
            </div>
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
              <a key={event.id} href={`/events/${event.id}`} className="card card-clickable" style={{ textDecoration: 'none', position: 'relative' }}>
                <div className="event-card-inner">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="event-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <button
                      className="btn-delete-event"
                      onClick={(e) => handleDeleteEvent(e, event.id, event.name)}
                      disabled={deletingEventId === event.id}
                      title="Delete event"
                      aria-label={`Delete ${event.name}`}
                    >
                      {deletingEventId === event.id ? (
                        <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="event-name">{event.name}</div>
                  <div className="event-meta">
                    {event.date && (
                      <div className="event-meta-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        {new Date(event.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {event.location && (
                      <div className="event-meta-item">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        {event.location}
                      </div>
                    )}
                  </div>
                  <div className="event-contacts-count">View Contacts →</div>
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
