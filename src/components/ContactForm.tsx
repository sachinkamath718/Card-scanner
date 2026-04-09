'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ExtractedContact } from '@/lib/gemini';

interface ContactFormProps {
    extracted: ExtractedContact;
    imageBase64: string;
    eventId: string;
    onSaved: () => void;
    onDiscard: () => void;
}

export default function ContactForm({ extracted, imageBase64, eventId, onSaved, onDiscard }: ContactFormProps) {
    const [form, setForm] = useState<ExtractedContact>({ ...extracted });
    const [saving, setSaving] = useState(false);

    function update(field: keyof ExtractedContact, value: string) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function handleSave() {
        setSaving(true);
        try {
            const res = await fetch('/api/contacts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_id: eventId,
                    ...form,
                    raw_image_url: `data:image/jpeg;base64,${imageBase64}`,
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            toast.success(`${form.first_name || 'Contact'} saved to event!`);
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
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700 }}>Card Scanned!</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Review and edit the extracted details below, then save.
                    </p>
                </div>
            </div>

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

            <div className="form-grid">
                <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="email@company.com" id="field-email" />
                </div>
                <div className="form-group">
                    <label className="form-label">Phone Number</label>
                    <input className="form-input" type="tel" value={form.phone_number} onChange={e => update('phone_number', e.target.value)} placeholder="+91 9876543210" id="field-phone" />
                </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving} id="btn-save-contact">
                    {saving ? <><span className="spinner" /> Saving...</> : 'Save Contact'}
                </button>
                <button className="btn btn-ghost" onClick={onDiscard} id="btn-discard-contact">
                    Discard
                </button>
            </div>
        </div>
    );
}
