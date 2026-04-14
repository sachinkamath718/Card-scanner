'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Event, Contact } from '@/lib/supabase';
import { ExtractedContact } from '@/lib/gemini';
import Scanner from '@/components/Scanner';
import ContactForm from '@/components/ContactForm';
import ContactsTable from '@/components/ContactsTable';

export default function EventDetailPage() {
    const params = useParams();
    const eventId = params.id as string;

    const [event, setEvent] = useState<Event | null>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loadingContacts, setLoadingContacts] = useState(true);
    const [extracted, setExtracted] = useState<ExtractedContact | null>(null);
    const [frontImageBase64, setFrontImageBase64] = useState('');
    const [backImageBase64, setBackImageBase64] = useState<string | null>(null);
    const [contactSearch, setContactSearch] = useState('');

    useEffect(() => {
        fetchEvent();
        fetchContacts();
    }, [eventId]);

    async function fetchEvent() {
        const res = await fetch('/api/events');
        const json = await res.json();
        if (res.ok) {
            const found = (json.data as Event[]).find(e => e.id === eventId);
            setEvent(found || null);
        }
    }

    const fetchContacts = useCallback(async () => {
        setLoadingContacts(true);
        try {
            const res = await fetch(`/api/contacts?event_id=${eventId}`);
            const json = await res.json();
            if (res.ok) setContacts(json.data || []);
        } finally {
            setLoadingContacts(false);
        }
    }, [eventId]);

    function handleExtracted(data: ExtractedContact, frontBase64: string, backBase64: string | null) {
        setExtracted(data);
        setFrontImageBase64(frontBase64);
        setBackImageBase64(backBase64);
    }

    function handleSaved() {
        setExtracted(null);
        setFrontImageBase64('');
        setBackImageBase64(null);
        fetchContacts();
    }

    function handleDiscard() {
        setExtracted(null);
        setFrontImageBase64('');
        setBackImageBase64(null);
    }

    function handleContactDeleted(id: string) {
        setContacts(prev => prev.filter(c => c.id !== id));
    }

    function handleDiscussionUpdated(id: string, text: string | null) {
        setContacts(prev => prev.map(c => c.id === id ? { ...c, discussion_details: text } : c));
    }

    return (
        <main>
            <div className="container" style={{ paddingTop: 32 }}>
                <a href="/" className="back-nav" id="btn-back-home">
                    ← Back to Events
                </a>

                <div className="page-header">
                    <div className="page-title-group">
                        <h1>{event?.name || 'Loading...'}</h1>
                        <p>
                            {event?.date && <><svg style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> {new Date(event.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</>}
                            {event?.location && <><span style={{ marginLeft: 16 }}><svg style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>{event.location}</span></>}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="badge badge-purple">{contacts.length} contacts</span>
                    </div>
                </div>

                {/* Scanner — includes Camera, Upload, QR Code, and CSV tabs */}
                {!extracted && (
                    <Scanner
                        onExtracted={handleExtracted}
                        eventId={eventId}
                        onCSVImported={fetchContacts}
                    />
                )}

                {/* Contact Form after scan */}
                {extracted && (
                    <ContactForm
                        extracted={extracted}
                        frontImageBase64={frontImageBase64}
                        backImageBase64={backImageBase64}
                        eventId={eventId}
                        onSaved={handleSaved}
                        onDiscard={handleDiscard}
                    />
                )}

                {/* Contacts Table */}
                <div className="contacts-section">
                    <div className="events-header">
                        <div>
                            <div className="section-label">Scanned at this event</div>
                            <div className="section-title">Contacts</div>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={fetchContacts} id="btn-refresh-contacts">
                            ↻ Refresh
                        </button>
                    </div>

                    {/* Contact search bar */}
                    {!loadingContacts && contacts.length > 0 && (
                        <div style={{ marginBottom: 16 }}>
                            <div style={{ position: 'relative', maxWidth: 380 }}>
                                <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }}
                                    width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                                </svg>
                                <input
                                    id="search-contacts"
                                    type="text"
                                    placeholder="Search by name, company, email…"
                                    value={contactSearch}
                                    onChange={e => setContactSearch(e.target.value)}
                                    style={{
                                        width: '100%', padding: '8px 32px 8px 34px',
                                        borderRadius: 8, border: '1.5px solid #e5e7eb',
                                        fontSize: 13, background: '#fff', color: '#111827',
                                        outline: 'none', boxSizing: 'border-box',
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#6366f1'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)'; }}
                                    onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                                />
                                {contactSearch && (
                                    <button onClick={() => setContactSearch('')}
                                        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}
                                        aria-label="Clear contact search">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <ContactsTable
                        contacts={contactSearch.trim() ? contacts.filter(c => {
                            const q = contactSearch.trim().toLowerCase();
                            return [
                                c.first_name, c.last_name, c.company_name,
                                c.job_title, c.email, c.phone_number,
                            ].some(v => (v || '').toLowerCase().includes(q));
                        }) : contacts}
                        loading={loadingContacts}
                        onDeleted={handleContactDeleted}
                        onDiscussionUpdated={handleDiscussionUpdated}
                    />
                </div>
            </div>
        </main>
    );
}
