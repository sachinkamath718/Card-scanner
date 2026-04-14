'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Contact } from '@/lib/supabase';

interface ContactsTableProps {
    contacts: Contact[];
    loading?: boolean;
    onDeleted?: (id: string) => void;
    onDiscussionUpdated?: (id: string, text: string | null) => void;
}

function getInitials(c: Contact) {
    const first = c.first_name?.[0] || '';
    const last = c.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function renderMultiValues(primary: string | null, additional: string | null, isEmail = false) {
    const all = [primary, ...(additional ? additional.split(',') : [])].filter(Boolean) as string[];
    if (!all.length) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {all.map((val, i) => (
                isEmail ? (
                    <a key={i} href={`mailto:${val}`} className="contact-email-link" style={{ fontSize: i === 0 ? 14 : 12, opacity: i === 0 ? 1 : 0.75 }}>{val}</a>
                ) : (
                    <span key={i} style={{ fontSize: i === 0 ? 14 : 12, opacity: i === 0 ? 1 : 0.75 }}>{val}</span>
                )
            ))}
        </div>
    );
}

export default function ContactsTable({ contacts, loading, onDeleted, onDiscussionUpdated }: ContactsTableProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [draftText, setDraftText] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);

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

    function startEdit(contact: Contact) {
        setEditingId(contact.id);
        setDraftText(contact.discussion_details ?? '');
    }

    function cancelEdit() {
        setEditingId(null);
        setDraftText('');
    }

    async function saveDiscussion(id: string) {
        // snapshot current text before any state change
        const textToSave = draftText;
        const original = contacts.find(c => c.id === id)?.discussion_details ?? '';
        if (textToSave === original) { cancelEdit(); return; }

        // Close editor and show saving spinner immediately
        setEditingId(null);
        setDraftText('');
        setSavingId(id);

        try {
            const res = await fetch(`/api/contacts?id=${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ discussion_details: textToSave || null }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            // Notify parent to update its contacts array
            onDiscussionUpdated?.(id, textToSave || null);
            toast.success('Discussion saved');
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save discussion');
        } finally {
            setSavingId(null);
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
                <div className="empty-desc">Capture your first business card above to get started</div>
            </div>
        );
    }

    return (
        <div className="contacts-table-wrap">
            <style>{`
                .discussion-cell { min-width: 180px; max-width: 280px; }
                .discussion-text {
                    cursor: pointer;
                    border-radius: 6px;
                    padding: 6px 8px;
                    min-height: 32px;
                    transition: background 0.15s;
                    word-break: break-word;
                    white-space: pre-wrap;
                    font-size: 13px;
                    line-height: 1.5;
                    display: flex;
                    align-items: flex-start;
                    gap: 6px;
                    justify-content: space-between;
                }
                .discussion-text:hover { background: rgba(99,102,241,0.1); }
                .discussion-text:hover .discussion-edit-icon { opacity: 1; }
                .discussion-edit-icon {
                    opacity: 0.35;
                    transition: opacity 0.15s;
                    flex-shrink: 0;
                    color: var(--primary, #6366f1);
                    margin-top: 1px;
                    cursor: pointer;
                }
                .discussion-textarea {
                    width: 100%;
                    min-height: 70px;
                    resize: vertical;
                    border-radius: 6px;
                    border: 1.5px solid var(--primary, #6366f1);
                    background: var(--surface, #1e1e2e);
                    color: inherit;
                    font-size: 13px;
                    line-height: 1.5;
                    padding: 6px 8px;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
                    font-family: inherit;
                    box-sizing: border-box;
                }
                .discussion-actions {
                    display: flex;
                    gap: 6px;
                    margin-top: 4px;
                    justify-content: flex-end;
                }
                .discussion-btn {
                    font-size: 11px;
                    padding: 3px 10px;
                    border-radius: 5px;
                    border: none;
                    cursor: pointer;
                    font-weight: 600;
                    transition: opacity 0.15s;
                }
                .discussion-btn:hover { opacity: 0.85; }
                .discussion-btn-save {
                    background: var(--primary, #6366f1);
                    color: #fff;
                }
                .discussion-btn-cancel {
                    background: rgba(255,255,255,0.08);
                    color: inherit;
                }
                .discussion-saving {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 12px;
                    color: var(--text-muted);
                }
            `}</style>
            <table className="contacts-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Company</th>
                        <th>Job Title</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Discussion</th>
                        <th>Scanned At</th>
                        <th style={{ width: 60 }}></th>
                    </tr>
                </thead>
                <tbody>
                    {contacts.map(contact => {
                        const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Unknown';
                        const isEditing = editingId === contact.id;
                        const isSaving = savingId === contact.id;

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
                                <td>{renderMultiValues(contact.email, contact.additional_emails, true)}</td>
                                <td>{renderMultiValues(contact.phone_number, contact.additional_phones, false)}</td>

                                {/* ── Discussion column ── */}
                                <td className="discussion-cell">
                                    {isSaving ? (
                                        <div className="discussion-saving">
                                            <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} />
                                            Saving…
                                        </div>
                                    ) : isEditing ? (
                                        <div>
                                            <textarea
                                                className="discussion-textarea"
                                                value={draftText}
                                                autoFocus
                                                onChange={e => setDraftText(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Escape') cancelEdit();
                                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) saveDiscussion(contact.id);
                                                }}
                                                placeholder="Add discussion notes…"
                                                id={`discussion-textarea-${contact.id}`}
                                            />
                                            <div className="discussion-actions">
                                                <button className="discussion-btn discussion-btn-cancel" onClick={cancelEdit}>Cancel</button>
                                                <button className="discussion-btn discussion-btn-save" onClick={() => saveDiscussion(contact.id)}>Save</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="discussion-text"
                                            onClick={() => startEdit(contact)}
                                            title="Click to edit discussion"
                                            id={`discussion-cell-${contact.id}`}
                                        >
                                            <span style={{ flex: 1 }}>
                                                {contact.discussion_details
                                                    ? contact.discussion_details
                                                    : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Click to add…</span>
                                                }
                                            </span>
                                            <span className="discussion-edit-icon" aria-label="Edit discussion">
                                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                </svg>
                                            </span>
                                        </div>
                                    )}
                                </td>

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
