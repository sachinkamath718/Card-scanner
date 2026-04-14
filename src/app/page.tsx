'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Event } from '@/lib/supabase';
import CreateEventModal from '@/components/CreateEventModal';

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 36px',
  borderRadius: 10,
  border: '1.5px solid #e5e7eb',
  fontSize: 14,
  background: '#fff',
  color: '#111827',
  outline: 'none',
  boxSizing: 'border-box',
};

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchEvents(); }, []);

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
      toast.success(`"${name}" deleted`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete event');
    } finally {
      setDeletingEventId(null);
    }
  }

  const q = searchQuery.trim().toLowerCase();
  const filteredEvents = q
    ? events.filter(ev =>
        ev.name.toLowerCase().includes(q) ||
        (ev.location || '').toLowerCase().includes(q) ||
        (ev.date || '').toLowerCase().includes(q)
      )
    : events;

  return (
    <main>
      <div className="page-shell">
        {/* ── Page header ── */}
        <div className="page-topbar">
          <div>
            <h1 className="page-topbar-title">Events</h1>
            <p className="page-topbar-sub">
              {loading ? '' : `${filteredEvents.length} event${filteredEvents.length !== 1 ? 's' : ''}${q ? ' found' : ''}`}
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)} id="btn-new-event">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Event
          </button>
        </div>

        {/* ── Search bar ── */}
        {!loading && events.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ position: 'relative', maxWidth: 420 }}>
              <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}
                width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
              <input
                id="search-events"
                type="text"
                placeholder="Search events by name, location…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={searchInputStyle}
                onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}
                  aria-label="Clear search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── Content ── */}
        {loading ? (
          <div className="events-grid">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="card">
                <div className="skeleton" style={{ height: 36, width: 36, borderRadius: 10, marginBottom: 20 }} />
                <div className="skeleton" style={{ height: 18, width: '65%', marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 13, width: '40%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 13, width: '30%' }} />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-box">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div className="empty-title">No events yet</div>
            <div className="empty-desc">Create an event to start capturing business cards.</div>
            <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setShowModal(true)} id="btn-create-first">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Create Event
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-box">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <div className="empty-title">No events match &ldquo;{searchQuery}&rdquo;</div>
            <div className="empty-desc">Try a different name or location.</div>
            <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setSearchQuery('')}>Clear search</button>
          </div>
        ) : (
          <div className="events-grid">
            {filteredEvents.map(event => (
              <a key={event.id} href={`/events/${event.id}`} className="event-card" style={{ textDecoration: 'none' }}>
                <div className="event-card-top">
                  <div className="event-card-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <button className="btn-delete-event" onClick={(e) => handleDeleteEvent(e, event.id, event.name)}
                    disabled={deletingEventId === event.id} title="Delete event" aria-label={`Delete ${event.name}`}>
                    {deletingEventId === event.id ? (
                      <span className="spinner" style={{ width: 13, height: 13, borderWidth: 1.5 }} />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="event-card-name">{event.name}</div>
                <div className="event-card-meta">
                  {event.date && (
                    <span className="event-meta-chip">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                      {new Date(event.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  {event.location && (
                    <span className="event-meta-chip">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
                      {event.location}
                    </span>
                  )}
                </div>
                <div className="event-card-footer">
                  View Contacts
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5l7 7-7 7" /></svg>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <CreateEventModal onClose={() => setShowModal(false)} onCreated={handleCreated} />
      )}
    </main>
  );
}
