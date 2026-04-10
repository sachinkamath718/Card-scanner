'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ExtractedContact } from '@/lib/gemini';

interface ContactFormProps {
    extracted: ExtractedContact;
    frontImageBase64: string;
    backImageBase64: string | null;
    eventId: string;
    onSaved: () => void;
    onDiscard: () => void;
}

export default function ContactForm({ extracted, frontImageBase64, backImageBase64, eventId, onSaved, onDiscard }: ContactFormProps) {
    const [form, setForm] = useState<ExtractedContact>({ ...extracted });
    const [additionalEmails, setAdditionalEmails] = useState<string[]>(extracted.additional_emails || []);
    const [additionalPhones, setAdditionalPhones] = useState<string[]>(extracted.additional_phones || []);
    const [discussionDetails, setDiscussionDetails] = useState('');
    const [saving, setSaving] = useState(false);

    function update(field: keyof ExtractedContact, value: string) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    function updateList(list: string[], setList: (v: string[]) => void, index: number, value: string) {
        const updated = [...list];
        updated[index] = value;
        setList(updated);
    }

    function removeFromList(list: string[], setList: (v: string[]) => void, index: number) {
        setList(list.filter((_, i) => i !== index));
    }

    async function handleSave() {
        setSaving(true);
        try {
            const cleanAdditionalEmails = additionalEmails.filter(e => e.trim()).join(',');
            const cleanAdditionalPhones = additionalPhones.filter(p => p.trim()).join(',');

            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id: eventId,
                    ...form,
                    raw_image_url: frontImageBase64 ? `data:image/jpeg;base64,${frontImageBase64}` : null,
                    back_image_url: backImageBase64 ? `data:image/jpeg;base64,${backImageBase64}` : null,
                    discussion_details: discussionDetails.trim() || null,
                    additional_emails: cleanAdditionalEmails || null,
                    additional_phones: cleanAdditionalPhones || null,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            toast.success(`${form.first_name || 'Contact'} saved!`);
            onSaved();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="contact-form-card">
            <div className="contact-form-header">
                <div className="contact-form-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>Contact Details Captured</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Review and edit the details below, then save to the event.
                        {backImageBase64 && <span className="badge badge-purple" style={{ marginLeft: 8, fontSize: 11 }}>Front + Back</span>}
                    </p>
                </div>
            </div>

            {/* Name */}
            <div className="form-grid">
                <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input className="form-input" value={form.first_name} onChange={e => update('first_name', e.target.value)} placeholder="First name" id="field-first-name" />
                </div>
                <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input className="form-input" value={form.last_name} onChange={e => update('last_name', e.target.value)} placeholder="Last name" id="field-last-name" />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">Company Name</label>
                <input className="form-input" value={form.company_name} onChange={e => update('company_name', e.target.value)} placeholder="Company" id="field-company" />
            </div>

            <div className="form-group">
                <label className="form-label">Job Title</label>
                <input className="form-input" value={form.job_title} onChange={e => update('job_title', e.target.value)} placeholder="Job title / Role" id="field-job-title" />
            </div>

            {/* Email(s) */}
            <div className="form-group">
                <label className="form-label">Primary Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="email@company.com" id="field-email" />
            </div>

            {additionalEmails.map((email, i) => (
                <div key={i} className="form-group multi-field-row">
                    <label className="form-label">Email {i + 2}</label>
                    <div className="multi-field-input-row">
                        <input className="form-input" type="email" value={email} onChange={e => updateList(additionalEmails, setAdditionalEmails, i, e.target.value)} placeholder={`Additional email ${i + 2}`} />
                        <button className="btn-remove-field" onClick={() => removeFromList(additionalEmails, setAdditionalEmails, i)} title="Remove" aria-label="Remove email">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>
                </div>
            ))}

            <button className="btn-add-field" onClick={() => setAdditionalEmails([...additionalEmails, ''])} id="btn-add-email">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add another email
            </button>

            {/* Phone(s) */}
            <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Primary Phone</label>
                <input className="form-input" type="tel" value={form.phone_number} onChange={e => update('phone_number', e.target.value)} placeholder="+91 9876543210" id="field-phone" />
            </div>

            {additionalPhones.map((phone, i) => (
                <div key={i} className="form-group multi-field-row">
                    <label className="form-label">Phone {i + 2}</label>
                    <div className="multi-field-input-row">
                        <input className="form-input" type="tel" value={phone} onChange={e => updateList(additionalPhones, setAdditionalPhones, i, e.target.value)} placeholder={`Additional phone ${i + 2}`} />
                        <button className="btn-remove-field" onClick={() => removeFromList(additionalPhones, setAdditionalPhones, i)} title="Remove" aria-label="Remove phone">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        </button>
                    </div>
                </div>
            ))}

            <button className="btn-add-field" onClick={() => setAdditionalPhones([...additionalPhones, ''])} id="btn-add-phone">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Add another phone
            </button>

            {/* Discussion Details */}
            <div className="discussion-section">
                <div className="discussion-label">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                    Discussion Details
                    <span className="discussion-optional">optional</span>
                </div>
                <textarea
                    className="form-input discussion-textarea"
                    id="field-discussion"
                    placeholder="Topics discussed, follow-up actions, interests, next steps…"
                    value={discussionDetails}
                    onChange={e => setDiscussionDetails(e.target.value)}
                    rows={4}
                />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-contact">
                    {saving ? <><span className="spinner" /> Saving...</> : 'Save Contact'}
                </button>
                <button className="btn btn-ghost" onClick={onDiscard} id="btn-discard-contact">Discard</button>
            </div>
        </div>
    );
}
