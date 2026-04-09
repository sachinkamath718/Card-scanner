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
    const [imageBase64, setImageBase64] = useState('');

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

    function handleExtracted(data: ExtractedContact, imgBase64: string) {
        setExtracted(data);
        setImageBase64(imgBase64);
    }

    function handleSaved() {
        setExtracted(null);
        setImageBase64('');
        fetchContacts();
    }

    function handleDiscard() {
        setExtracted(null);
        setImageBase64('');
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
                            {event?.date && <><svg style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> {new Date(event.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</>}
                            {event?.location && <><span style={{ marginLeft: 16 }}><svg style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>{event.location}</span></>}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span className="badge badge-purple">{contacts.length} contacts</span>
                    </div>
                </div>

                {/* Scanner */}
                {!extracted && (
                    <Scanner onExtracted={handleExtracted} />
                )}

                {/* Contact Form after scan */}
                {extracted && (
                    <ContactForm
                        extracted={extracted}
                        imageBase64={imageBase64}
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
                    <ContactsTable contacts={contacts} loading={loadingContacts} />
                </div>
            </div>
        </main>
    );
}
