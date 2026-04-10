/**
 * Parses QR code decoded text into a structured ExtractedContact.
 * Supports: vCard 2.1 / 3.0, plain text, URLs.
 */

export interface QRContactResult {
    contact: {
        first_name: string;
        last_name: string;
        company_name: string;
        job_title: string;
        email: string;
        phone_number: string;
        additional_emails: string[];
        additional_phones: string[];
    };
    raw: string;
    type: 'vcard' | 'url' | 'text';
}

function getVCardField(lines: string[], key: string): string {
    // Match lines like TEL:+123, TEL;TYPE=work:+123, EMAIL:foo@bar.com
    const regex = new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, 'i');
    for (const line of lines) {
        const m = line.match(regex);
        if (m) return m[1].trim();
    }
    return '';
}

function getAllVCardFields(lines: string[], key: string): string[] {
    const regex = new RegExp(`^${key}(?:;[^:]*)?:(.+)$`, 'i');
    const results: string[] = [];
    for (const line of lines) {
        const m = line.match(regex);
        if (m) results.push(m[1].trim());
    }
    return results;
}

export function parseQRCode(raw: string): QRContactResult {
    const trimmed = raw.trim();

    // ── vCard ────────────────────────────────────────────────────────────
    if (trimmed.toUpperCase().startsWith('BEGIN:VCARD')) {
        const lines = trimmed.split(/\r?\n/);

        // Full Name
        const fn = getVCardField(lines, 'FN');

        // N field: Lastname;Firstname;Middle;Prefix;Suffix
        const nField = getVCardField(lines, 'N');
        let first_name = '';
        let last_name = '';
        if (nField) {
            const parts = nField.split(';');
            last_name = parts[0]?.trim() || '';
            first_name = parts[1]?.trim() || '';
        }
        // Fallback: parse FN
        if (!first_name && fn) {
            const parts = fn.trim().split(' ');
            first_name = parts[0] || '';
            last_name = parts.slice(1).join(' ') || '';
        }

        const company_name = getVCardField(lines, 'ORG');
        const job_title = getVCardField(lines, 'TITLE');

        const allPhones = getAllVCardFields(lines, 'TEL');
        const allEmails = getAllVCardFields(lines, 'EMAIL');

        return {
            contact: {
                first_name,
                last_name,
                company_name,
                job_title,
                email: allEmails[0] || '',
                phone_number: allPhones[0] || '',
                additional_emails: allEmails.slice(1),
                additional_phones: allPhones.slice(1),
            },
            raw,
            type: 'vcard',
        };
    }

    // ── URL ──────────────────────────────────────────────────────────────
    if (/^https?:\/\//i.test(trimmed)) {
        return {
            contact: {
                first_name: '',
                last_name: '',
                company_name: '',
                job_title: '',
                email: '',
                phone_number: '',
                additional_emails: [],
                additional_phones: [],
            },
            raw,
            type: 'url',
        };
    }

    // ── Plain text ───────────────────────────────────────────────────────
    // Try to extract common patterns
    const emailMatch = trimmed.match(/[\w.-]+@[\w.-]+\.[a-z]{2,}/i);
    const phoneMatch = trimmed.match(/[\+]?[\d\s\-().]{7,}/);

    return {
        contact: {
            first_name: '',
            last_name: '',
            company_name: '',
            job_title: '',
            email: emailMatch ? emailMatch[0] : '',
            phone_number: phoneMatch ? phoneMatch[0].trim() : '',
            additional_emails: [],
            additional_phones: [],
        },
        raw,
        type: 'text',
    };
}
