'use client';

import { useState } from 'react';
import { Event } from '@/lib/supabase';

interface CreateEventModalProps {
    onClose: () => void;
    onCreated: (event: Event) => void;
}

export default function CreateEventModal({ onClose, onCreated }: CreateEventModalProps) {
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [location, setLocation] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) { setError('Event name is required'); return; }
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, date, location }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            onCreated(json.data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to create event');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal-title">
                    <span>🎪</span> Create New Event
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Event Name *</label>
                        <input
                            className="form-input"
                            placeholder="e.g. TechConf 2026"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            required
                            autoFocus
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Date</label>
                        <input
                            className="form-input"
                            type="date"
                            value={date}
                            onChange={e => setDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">Location</label>
                        <input
                            className="form-input"
                            placeholder="e.g. Bangalore Convention Centre"
                            value={location}
                            onChange={e => setLocation(e.target.value)}
                        />
                    </div>
                    {error && (
                        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>⚠️ {error}</div>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? <><span className="spinner" /> Creating...</> : '✓ Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
