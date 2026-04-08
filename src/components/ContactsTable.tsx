'use client';

import { Contact } from '@/lib/supabase';

interface ContactsTableProps {
    contacts: Contact[];
    loading?: boolean;
}

function getInitials(c: Contact) {
    const first = c.first_name?.[0] || '';
    const last = c.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ContactsTable({ contacts, loading }: ContactsTableProps) {
    if (loading) {
        return (
            <div style={{ padding: '40px 0' }}>
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton" style={{ height: 52, marginBottom: 8 }} />
                ))}
            </div>
        );
    }

    if (!contacts.length) {
        return (
            <div className="empty-state">
                <span className="empty-icon">📭</span>
                <div className="empty-title">No contacts yet</div>
                <div className="empty-desc">Scan your first business card above to get started</div>
            </div>
        );
    }

    return (
        <div className="contacts-table-wrap">
            <table className="contacts-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Job Title</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Scanned At</th>
                    </tr>
                </thead>
                <tbody>
                    {contacts.map(contact => (
                        <tr key={contact.id}>
                            <td>
                                <div className="contact-name-cell">
                                    <div className="contact-avatar">{getInitials(contact)}</div>
                                    <span>{[contact.first_name, contact.last_name].filter(Boolean).join(' ') || '—'}</span>
                                </div>
                            </td>
                            <td>{contact.company_name || ''}</td>
                            <td>{contact.job_title || ''}</td>
                            <td>
                                {contact.email ? (
                                    <a href={`mailto:${contact.email}`} className="contact-email-link">{contact.email}</a>
                                ) : ''}
                            </td>
                            <td>{contact.phone_number || ''}</td>
                            <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{formatDate(contact.scanned_at)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
