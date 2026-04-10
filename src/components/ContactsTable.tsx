'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Contact } from '@/lib/supabase';

interface ContactsTableProps {
    contacts: Contact[];
    loading?: boolean;
    onDeleted?: (id: string) => void;
}

function getInitials(c: Contact) {
    const first = c.first_name?.[0] || '';
    const last = c.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ContactsTable({ contacts, loading, onDeleted }: ContactsTableProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);

    async function handleDelete(id: string, name: string) {
        if (!confirm(`Delete contact "${name}"? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            toast.success('Contact deleted');
            onDeleted?.(id);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to delete');
        } finally {
            setDeletingId(null);
        }
    }

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
                <div className="empty-icon-box">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                    </svg>
                </div>
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
                        <th style={{ width: 60 }}></th>
                    </tr>
                </thead>
                <tbody>
                    {contacts.map(contact => {
                        const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown';
                        return (
                            <tr key={contact.id}>
                                <td>
                                    <div className="contact-name-cell">
                                        <div className="contact-avatar">{getInitials(contact)}</div>
                                        <span>{fullName}</span>
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
                                <td>
                                    <button
                                        className="btn-delete-contact"
                                        onClick={() => handleDelete(contact.id, fullName)}
                                        disabled={deletingId === contact.id}
                                        title="Delete contact"
                                        aria-label={`Delete ${fullName}`}
                                        id={`btn-delete-${contact.id}`}
                                    >
                                        {deletingId === contact.id ? (
                                            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                                        ) : (
                                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                                            </svg>
                                        )}
                                    </button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
