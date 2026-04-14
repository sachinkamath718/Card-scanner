'use client';

import { useState, useRef } from 'react';
import toast from 'react-hot-toast';

// The exact CSV columns that map to our Supabase contacts table
const CSV_COLUMNS = [
    { key: 'first_name',        label: 'First Name',        required: false, example: 'Rahul' },
    { key: 'last_name',         label: 'Last Name',         required: false, example: 'Sharma' },
    { key: 'company_name',      label: 'Company Name',      required: false, example: 'Acme Corp' },
    { key: 'job_title',         label: 'Job Title',         required: false, example: 'VP of Engineering' },
    { key: 'email',             label: 'Email',             required: false, example: 'rahul@acme.com' },
    { key: 'phone_number',      label: 'Phone Number',      required: false, example: '+91-9876543210' },
    { key: 'additional_emails', label: 'Additional Emails', required: false, example: 'r.sharma@gmail.com' },
    { key: 'additional_phones', label: 'Additional Phones', required: false, example: '+91-8765432109' },
    { key: 'discussion_details',label: 'Discussion Details',required: false, example: 'Discussed partnership on Day 2' },
];

interface Props {
    eventId: string;
    onImported: () => void;
}

type ParsedRow = Record<string, string>;

function parseCSV(text: string): { headers: string[]; rows: ParsedRow[] } {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuotes = !inQuotes; }
            else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur = ''; }
            else { cur += ch; }
        }
        result.push(cur.trim());
        return result;
    };

    const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const vals = parseRow(lines[i]);
        if (vals.every(v => !v)) continue;
        const row: ParsedRow = {};
        headers.forEach((h, idx) => { row[h] = vals[idx] || ''; });
        rows.push(row);
    }
    return { headers, rows };
}

function downloadTemplate() {
    const header = CSV_COLUMNS.map(c => c.key).join(',');
    const example = CSV_COLUMNS.map(c => `"${c.example}"`).join(',');
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'contacts_template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
}

export default function CSVUploader({ eventId, onImported }: Props) {
    const [showTemplateGuide, setShowTemplateGuide] = useState(false);
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
    const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ inserted: number } | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    function handleFile(file: File) {
        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
            toast.error('Please upload a .csv file');
            return;
        }
        setImportResult(null);
        const reader = new FileReader();
        reader.onload = e => {
            const text = e.target?.result as string;
            const { headers, rows } = parseCSV(text);
            if (!rows.length) { toast.error('CSV is empty or invalid'); return; }
            setParsedHeaders(headers);
            setParsedRows(rows);
        };
        reader.readAsText(file);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }

    async function handleImport() {
        if (!parsedRows.length) return;
        setImporting(true);
        try {
            const res = await fetch('/api/contacts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: eventId, rows: parsedRows }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setImportResult({ inserted: json.inserted });
            setParsedRows([]);
            setParsedHeaders([]);
            toast.success(`${json.inserted} contact${json.inserted !== 1 ? 's' : ''} imported!`);
            onImported();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setImporting(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    }

    function handleClear() {
        setParsedRows([]);
        setParsedHeaders([]);
        setImportResult(null);
        if (fileRef.current) fileRef.current.value = '';
    }

    const knownCols = CSV_COLUMNS.map(c => c.key);
    const unknownCols = parsedHeaders.filter(h => !knownCols.includes(h));
    const matchedCols = parsedHeaders.filter(h => knownCols.includes(h));

    return (
        <div className="csv-uploader-section">
            <style>{`
                .csv-uploader-section {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 28px 32px;
                    margin-bottom: 32px;
                }
                .csv-header-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .csv-title {
                    font-size: 18px;
                    font-weight: 700;
                    margin: 0;
                }
                .csv-title-sub {
                    font-size: 13px;
                    color: var(--text-secondary);
                    margin-top: 3px;
                }
                .csv-actions-row {
                    display: flex;
                    gap: 8px;
                    flex-wrap: wrap;
                }
                .csv-drop-zone {
                    border: 2px dashed var(--border);
                    border-radius: var(--radius);
                    padding: 36px 24px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    background: var(--bg-secondary);
                }
                .csv-drop-zone.drag { border-color: #6366f1; background: rgba(99,102,241,0.05); }
                .csv-drop-zone:hover { border-color: #6366f1; background: rgba(99,102,241,0.04); }
                .csv-drop-icon { color: var(--text-muted); margin-bottom: 10px; }
                .csv-drop-title { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
                .csv-drop-sub { font-size: 13px; color: var(--text-muted); }
                .csv-template-guide {
                    margin-top: 20px;
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    overflow: hidden;
                }
                .csv-template-header {
                    background: var(--bg-secondary);
                    padding: 12px 16px;
                    font-size: 13px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--text-secondary);
                }
                .csv-col-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                }
                .csv-col-table th {
                    text-align: left;
                    padding: 10px 16px;
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.8px;
                    color: var(--text-muted);
                    background: var(--bg-secondary);
                    border-bottom: 1px solid var(--border);
                }
                .csv-col-table td {
                    padding: 10px 16px;
                    border-bottom: 1px solid var(--border);
                    color: var(--text-primary);
                    vertical-align: middle;
                }
                .csv-col-table tr:last-child td { border-bottom: none; }
                .csv-col-table tr:hover td { background: var(--bg-card-hover); }
                .col-key {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    background: rgba(99,102,241,0.08);
                    color: #6366f1;
                    padding: 2px 7px;
                    border-radius: 4px;
                    border: 1px solid rgba(99,102,241,0.2);
                }
                .col-example { color: var(--text-muted); font-style: italic; }
                .csv-preview-section { margin-top: 20px; }
                .csv-preview-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .csv-preview-title { font-size: 14px; font-weight: 600; }
                .csv-preview-meta { font-size: 12px; color: var(--text-muted); }
                .csv-warning {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    background: rgba(245,158,11,0.08);
                    border: 1px solid rgba(245,158,11,0.25);
                    border-radius: 8px;
                    padding: 10px 14px;
                    font-size: 12px;
                    color: #b45309;
                    margin-bottom: 12px;
                }
                .csv-table-wrap {
                    overflow-x: auto;
                    border: 1px solid var(--border);
                    border-radius: var(--radius);
                    max-height: 320px;
                    overflow-y: auto;
                }
                .csv-data-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 12px;
                }
                .csv-data-table th {
                    padding: 10px 14px;
                    text-align: left;
                    background: var(--bg-secondary);
                    border-bottom: 1px solid var(--border);
                    font-size: 11px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.6px;
                    color: var(--text-muted);
                    white-space: nowrap;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                }
                .csv-data-table th.unknown-col { color: #b45309; }
                .csv-data-table td {
                    padding: 8px 14px;
                    border-bottom: 1px solid var(--border);
                    color: var(--text-primary);
                    white-space: nowrap;
                    max-width: 200px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .csv-data-table tr:last-child td { border-bottom: none; }
                .csv-data-table tr:hover td { background: var(--bg-card-hover); }
                .csv-import-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 14px;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .csv-import-info { font-size: 13px; color: var(--text-secondary); }
                .csv-import-info strong { color: var(--text-primary); }
                .csv-success {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: rgba(34,197,94,0.08);
                    border: 1px solid rgba(34,197,94,0.2);
                    border-radius: 8px;
                    padding: 12px 16px;
                    font-size: 13px;
                    color: #15803d;
                    font-weight: 500;
                    margin-top: 16px;
                }
            `}</style>

            {/* Header */}
            <div className="csv-header-row">
                <div>
                    <h3 className="csv-title">Import from CSV</h3>
                    <p className="csv-title-sub">Bulk-upload prospects directly from a spreadsheet</p>
                </div>
                <div className="csv-actions-row">
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setShowTemplateGuide(v => !v)}
                    >
                        {showTemplateGuide ? 'Hide' : 'View'} Column Guide
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        Download Template
                    </button>
                </div>
            </div>

            {/* Column guide */}
            {showTemplateGuide && (
                <div className="csv-template-guide">
                    <div className="csv-template-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        Required CSV column headers — copy these exactly into row 1 of your spreadsheet
                    </div>
                    <table className="csv-col-table">
                        <thead>
                            <tr>
                                <th>Column Header (exact)</th>
                                <th>Field</th>
                                <th>Example Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {CSV_COLUMNS.map(col => (
                                <tr key={col.key}>
                                    <td><span className="col-key">{col.key}</span></td>
                                    <td>{col.label}</td>
                                    <td className="col-example">{col.example}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Drop zone — only show if no file parsed yet */}
            {parsedRows.length === 0 && !importResult && (
                <div
                    className={`csv-drop-zone${dragOver ? ' drag' : ''}`}
                    style={{ marginTop: showTemplateGuide ? 16 : 0 }}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    id="csv-drop-zone"
                >
                    <div className="csv-drop-icon">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
                            <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/>
                        </svg>
                    </div>
                    <div className="csv-drop-title">Drop your CSV file here</div>
                    <div className="csv-drop-sub">or click to browse · .csv files only</div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".csv,text/csv"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                    />
                </div>
            )}

            {/* Import success message */}
            {importResult && (
                <div className="csv-success">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    {importResult.inserted} contact{importResult.inserted !== 1 ? 's' : ''} imported successfully.
                    <button
                        className="btn btn-secondary btn-sm"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => { setImportResult(null); }}
                    >
                        Import Another
                    </button>
                </div>
            )}

            {/* Preview table */}
            {parsedRows.length > 0 && (
                <div className="csv-preview-section">
                    {unknownCols.length > 0 && (
                        <div className="csv-warning">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                            </svg>
                            <span>
                                Unknown column{unknownCols.length > 1 ? 's' : ''} will be ignored:{' '}
                                <strong>{unknownCols.join(', ')}</strong>.
                                Only matched columns ({matchedCols.length}) will be imported.
                            </span>
                        </div>
                    )}
                    <div className="csv-preview-header">
                        <div>
                            <span className="csv-preview-title">Preview</span>
                            <span className="csv-preview-meta" style={{ marginLeft: 10 }}>
                                {parsedRows.length} row{parsedRows.length !== 1 ? 's' : ''} · {matchedCols.length} matched column{matchedCols.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={handleClear}>✕ Clear</button>
                    </div>

                    <div className="csv-table-wrap">
                        <table className="csv-data-table">
                            <thead>
                                <tr>
                                    <th style={{ color: 'var(--text-muted)' }}>#</th>
                                    {parsedHeaders.map(h => (
                                        <th key={h} className={knownCols.includes(h) ? '' : 'unknown-col'}>
                                            {h}{!knownCols.includes(h) ? ' ⚠' : ''}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {parsedRows.slice(0, 20).map((row, i) => (
                                    <tr key={i}>
                                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                                        {parsedHeaders.map(h => (
                                            <td key={h} title={row[h]}>{row[h] || '—'}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {parsedRows.length > 20 && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
                            Showing first 20 rows · {parsedRows.length - 20} more will also be imported
                        </p>
                    )}

                    <div className="csv-import-bar">
                        <div className="csv-import-info">
                            Ready to import <strong>{parsedRows.length} contact{parsedRows.length !== 1 ? 's' : ''}</strong> into this event
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-ghost btn-sm" onClick={handleClear} disabled={importing}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleImport}
                                disabled={importing || matchedCols.length === 0}
                                id="btn-csv-import"
                            >
                                {importing ? (
                                    <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Importing…</>
                                ) : (
                                    <>Import {parsedRows.length} Contact{parsedRows.length !== 1 ? 's' : ''}</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
