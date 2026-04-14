'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ExtractedContact } from '@/lib/gemini';
import { parseQRCode } from '@/lib/qrParser';

interface ScannerProps {
    onExtracted: (data: ExtractedContact, frontBase64: string, backBase64: string | null) => void;
    eventId?: string;
    onCSVImported?: () => void;
}

type ScanStep = 'idle' | 'scanning-front' | 'front-done' | 'scanning-back' | 'processing';
type ScanTab = 'camera' | 'upload' | 'qr' | 'csv';

export default function Scanner({ onExtracted, eventId, onCSVImported }: ScannerProps) {
    const [tab, setTab] = useState<ScanTab>('camera');
    const [step, setStep] = useState<ScanStep>('idle');
    const [cameraActive, setCameraActive] = useState(false);
    const [qrActive, setQrActive] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [frontPreview, setFrontPreview] = useState<string | null>(null);
    const [backPreview, setBackPreview] = useState<string | null>(null);
    const [frontBase64, setFrontBase64] = useState('');
    const [frontMime, setFrontMime] = useState('image/jpeg');
    const [backBase64, setBackBase64] = useState('');
    const [backMime, setBackMime] = useState('image/jpeg');
    const [dragOver, setDragOver] = useState(false);
    const [qrResult, setQrResult] = useState<string | null>(null);
    const [qrScanning, setQrScanning] = useState(false);
    // CSV tab state
    const [csvDragOver, setCsvDragOver] = useState(false);
    const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [csvImporting, setCsvImporting] = useState(false);
    const [csvResult, setCsvResult] = useState<{ inserted: number } | null>(null);
    const [showColGuide, setShowColGuide] = useState(false);
    const csvFileRef = useRef<HTMLInputElement>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const qrVideoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const qrStreamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const qrAnimRef = useRef<number | null>(null);
    const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Wire camera stream to video element
    useEffect(() => {
        if (cameraActive && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [cameraActive]);

    useEffect(() => {
        if (qrActive && qrVideoRef.current && qrStreamRef.current) {
            qrVideoRef.current.srcObject = qrStreamRef.current;
            qrVideoRef.current.play();
        }
    }, [qrActive]);

    // ── Camera helpers ────────────────────────────────────────────────
    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
            });
            streamRef.current = stream;
            setCameraActive(true);
        } catch {
            toast.error('Unable to access camera. Please check permissions or use file upload.');
        }
    }, []);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCameraActive(false);
    }, []);

    // ── QR scanner helpers ────────────────────────────────────────────
    const stopQR = useCallback(() => {
        if (qrAnimRef.current) cancelAnimationFrame(qrAnimRef.current);
        qrStreamRef.current?.getTracks().forEach(t => t.stop());
        qrStreamRef.current = null;
        setQrActive(false);
        setQrScanning(false);
    }, []);

    const startQRScanner = useCallback(async () => {
        setQrResult(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
            });
            qrStreamRef.current = stream;
            setQrActive(true);
            setQrScanning(true);
        } catch {
            toast.error('Unable to access camera for QR scanning. Please check permissions.');
        }
    }, []);

    // Continuous QR scan loop
    useEffect(() => {
        if (!qrActive || !qrScanning) return;

        let stopped = false;

        async function scanLoop() {
            const jsqr = (await import('jsqr')).default;
            if (!qrCanvasRef.current) qrCanvasRef.current = document.createElement('canvas');
            const canvas = qrCanvasRef.current;

            function tick() {
                if (stopped) return;
                const video = qrVideoRef.current;
                if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(video, 0, 0);
                        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                        const code = jsqr(imageData.data, imageData.width, imageData.height, {
                            inversionAttempts: 'dontInvert',
                        });
                        if (code) {
                            stopped = true;
                            stopQR();
                            handleQRDetected(code.data);
                            return;
                        }
                    }
                }
                qrAnimRef.current = requestAnimationFrame(tick);
            }
            tick();
        }

        scanLoop();

        return () => {
            stopped = true;
            if (qrAnimRef.current) cancelAnimationFrame(qrAnimRef.current);
        };
    }, [qrActive, qrScanning, stopQR]);

    function handleQRDetected(data: string) {
        const result = parseQRCode(data);
        setQrResult(data);

        if (result.type === 'url') {
            toast('QR contains a URL — review and fill in contact details manually.', { icon: '🔗' });
        } else if (result.type === 'vcard') {
            toast.success('vCard QR code detected! Contact details extracted.');
        } else {
            toast('QR code read. Some details may need to be filled in manually.', { icon: '📋' });
        }

        onExtracted(result.contact as ExtractedContact, '', null);
    }

    // ── Card capture ──────────────────────────────────────────────────
    const capturePhoto = useCallback(async () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        canvas.getContext('2d')!.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        const b64 = dataUrl.split(',')[1];
        stopCamera();

        if (step === 'scanning-front' || step === 'idle') {
            setFrontPreview(dataUrl);
            setFrontBase64(b64);
            setFrontMime('image/jpeg');
            setStep('front-done');
        } else if (step === 'scanning-back') {
            setBackPreview(dataUrl);
            setBackBase64(b64);
            setBackMime('image/jpeg');
            await processImages(frontBase64, frontMime, b64, 'image/jpeg');
        }
    }, [step, stopCamera, frontBase64, frontMime]);

    async function processImages(fBase64: string, fMime: string, bBase64?: string, bMime?: string) {
        setProcessing(true);
        setStep('processing');
        try {
            const body: Record<string, string> = { image: fBase64, mimeType: fMime };
            if (bBase64) { body.backImage = bBase64; body.backMimeType = bMime || 'image/jpeg'; }
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            toast.success('Card scanned successfully!');
            onExtracted(json.data, fBase64, bBase64 || null);
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Scan failed');
            setStep('front-done');
        } finally {
            setProcessing(false);
        }
    }

    function handleFileChange(file: File | null, side: 'front' | 'back') {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;
            const b64 = dataUrl.split(',')[1];
            const mime = file.type || 'image/jpeg';
            if (side === 'front') {
                setFrontPreview(dataUrl);
                setFrontBase64(b64);
                setFrontMime(mime);
                setStep('front-done');
            } else {
                setBackPreview(dataUrl);
                setBackBase64(b64);
                setBackMime(mime);
                await processImages(frontBase64, frontMime, b64, mime);
            }
        };
        reader.readAsDataURL(file);
    }

    function handleDrop(e: React.DragEvent, side: 'front' | 'back') {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleFileChange(file, side);
    }

    function resetAll() {
        setStep('idle');
        setFrontPreview(null);
        setBackPreview(null);
        setFrontBase64('');
        setBackBase64('');
        setQrResult(null);
        stopCamera();
        stopQR();
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function switchTab(t: ScanTab) {
        setTab(t);
        resetAll();
        setCsvRows([]);
        setCsvHeaders([]);
        setCsvResult(null);
    }

    // ── CSV helpers ───────────────────────────────────────────────────
    const CSV_COLUMNS = [
        { key: 'first_name', label: 'First Name', example: 'Rahul' },
        { key: 'last_name', label: 'Last Name', example: 'Sharma' },
        { key: 'company_name', label: 'Company Name', example: 'Acme Corp' },
        { key: 'job_title', label: 'Job Title', example: 'VP of Engineering' },
        { key: 'email', label: 'Email', example: 'rahul@acme.com' },
        { key: 'phone_number', label: 'Phone Number', example: '+91-9876543210' },
        { key: 'additional_emails', label: 'Additional Emails', example: 'r.sharma@gmail.com' },
        { key: 'additional_phones', label: 'Additional Phones', example: '+91-8765432109' },
        { key: 'discussion_details', label: 'Discussion Details', example: 'Met at Day 2 booth' },
    ];

    function parseCSV(text: string) {
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) return { headers: [] as string[], rows: [] as Record<string, string>[] };
        const parseRow = (line: string) => {
            const res: string[] = []; let cur = ''; let inQ = false;
            for (const ch of line) {
                if (ch === '"') { inQ = !inQ; }
                else if (ch === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
                else { cur += ch; }
            }
            res.push(cur.trim()); return res;
        };
        const headers = parseRow(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
        const rows = lines.slice(1).map(line => {
            const vals = parseRow(line);
            const row: Record<string, string> = {};
            headers.forEach((h, i) => { row[h] = vals[i] || ''; });
            return row;
        }).filter(r => Object.values(r).some(v => v));
        return { headers, rows };
    }

    function handleCSVFile(file: File) {
        if (!file.name.endsWith('.csv') && file.type !== 'text/csv') { toast.error('Please upload a .csv file'); return; }
        setCsvResult(null);
        const reader = new FileReader();
        reader.onload = e => {
            const { headers, rows } = parseCSV(e.target?.result as string);
            if (!rows.length) { toast.error('CSV is empty or invalid'); return; }
            setCsvHeaders(headers); setCsvRows(rows);
        };
        reader.readAsText(file);
    }

    function downloadCSVTemplate() {
        const header = CSV_COLUMNS.map(c => c.key).join(',');
        const example = CSV_COLUMNS.map(c => `"${c.example}"`).join(',');
        const blob = new Blob([`${header}\n${example}\n`], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'contacts_template.csv'; a.click(); URL.revokeObjectURL(a.href);
    }

    async function handleCSVImport() {
        if (!csvRows.length || !eventId) return;
        setCsvImporting(true);
        try {
            const res = await fetch('/api/contacts', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event_id: eventId, rows: csvRows }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setCsvResult({ inserted: json.inserted });
            setCsvRows([]); setCsvHeaders([]);
            toast.success(`${json.inserted} contact${json.inserted !== 1 ? 's' : ''} imported!`);
            onCSVImported?.();
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : 'Import failed');
        } finally {
            setCsvImporting(false);
            if (csvFileRef.current) csvFileRef.current.value = '';
        }
    }

    // ── Camera view ───────────────────────────────────────────────────
    function renderCamera(side: 'front' | 'back') {
        const preview = side === 'front' ? frontPreview : backPreview;
        if (preview && !cameraActive) {
            return (
                <div style={{ textAlign: 'center' }}>
                    <img src={preview} alt={`${side} of card`} className="preview-image" />
                    <button className="btn btn-secondary btn-sm" onClick={() => { if (side === 'front') { setFrontPreview(null); setStep('idle'); } else { setBackPreview(null); setStep('front-done'); } }}>Retake</button>
                </div>
            );
        }
        return (
            <div>
                {!cameraActive && (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15 }}>
                            {side === 'front' ? 'Position the front of the business card in the frame' : 'Now position the back of the card'}
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={() => { setStep(side === 'front' ? 'scanning-front' : 'scanning-back'); startCamera(); }} id={`btn-start-camera-${side}`}>Start Camera</button>
                    </div>
                )}

                {/* ── Full-screen camera overlay ── */}
                {cameraActive && (
                    <div className="camera-fullscreen">
                        <video ref={videoRef} autoPlay playsInline muted className="camera-fullscreen-video" />

                        {/* Top bar */}
                        <div className="camera-fullscreen-top">
                            <span className="camera-fullscreen-label">
                                {side === 'front' ? '📷 Front of card' : '📷 Back of card'}
                            </span>
                            <button className="camera-fullscreen-close" onClick={stopCamera} aria-label="Cancel">✕</button>
                        </div>

                        {/* Card guide */}
                        <div className="camera-fullscreen-guide">
                            <div className="cfs-corner cfs-tl" />
                            <div className="cfs-corner cfs-tr" />
                            <div className="cfs-corner cfs-bl" />
                            <div className="cfs-corner cfs-br" />
                        </div>

                        {/* Bottom — capture */}
                        <div className="camera-fullscreen-bottom">
                            <p className="camera-fullscreen-hint">Hold card flat &amp; tap to capture</p>
                            <button className="capture-btn" onClick={capturePhoto} id={`btn-capture-${side}`} aria-label="Capture">
                                <div className="capture-btn-inner" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Upload view ───────────────────────────────────────────────────
    function renderUpload(side: 'front' | 'back') {
        const preview = side === 'front' ? frontPreview : backPreview;
        if (preview) {
            return (
                <div style={{ textAlign: 'center' }}>
                    <img src={preview} alt={`${side} of card`} className="preview-image" />
                    <button className="btn btn-secondary btn-sm" onClick={() => { if (side === 'front') { setFrontPreview(null); setStep('idle'); } else { setBackPreview(null); setStep('front-done'); } if (fileInputRef.current) fileInputRef.current.value = ''; }}>Upload Another</button>
                </div>
            );
        }
        return (
            <div className={`upload-area ${dragOver ? 'dragging' : ''}`} onClick={() => fileInputRef.current?.click()} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => handleDrop(e, side)} id={`upload-area-${side}`}>
                <span className="upload-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg></span>
                <div className="upload-title">{side === 'front' ? 'Drop the front of your card here' : 'Drop the back of your card here'}</div>
                <div className="upload-subtitle">or click to browse · JPG, PNG, WEBP, HEIC</div>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileChange(e.target.files?.[0] || null, side)} />
            </div>
        );
    }

    // ── QR Code view ──────────────────────────────────────────────────
    function renderQR() {
        if (qrResult) {
            return (
                <div className="qr-result-card">
                    <div className="qr-result-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>QR Code Scanned</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', maxWidth: 320 }}>{qrResult.length > 120 ? qrResult.slice(0, 120) + '…' : qrResult}</div>
                    </div>
                </div>
            );
        }

        return (
            <div>
                {!qrActive && (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                                <rect x="5" y="5" width="3" height="3" fill="currentColor" /><rect x="16" y="5" width="3" height="3" fill="currentColor" /><rect x="5" y="16" width="3" height="3" fill="currentColor" />
                                <path d="M14 14h3v3" /><path d="M17 17v4" /><path d="M21 14v3h-4" />
                            </svg>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 8, fontSize: 15 }}>Scan a QR code from a business card</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 24 }}>Supports vCard QR codes and standard formats</p>
                        <button className="btn btn-primary btn-lg" onClick={startQRScanner} id="btn-start-qr">Start QR Scanner</button>
                    </div>
                )}

                {/* ── Full-screen QR overlay ── */}
                {qrActive && (
                    <div className="camera-fullscreen">
                        <video ref={qrVideoRef} autoPlay playsInline muted className="camera-fullscreen-video" />

                        <div className="camera-fullscreen-top">
                            <span className="camera-fullscreen-label">🔲 QR Code Scanner</span>
                            <button className="camera-fullscreen-close" onClick={stopQR} aria-label="Cancel">✕</button>
                        </div>

                        {/* QR guide corners */}
                        <div className="camera-fullscreen-guide qr-guide-fs">
                            <div className="cfs-corner cfs-tl" />
                            <div className="cfs-corner cfs-tr" />
                            <div className="cfs-corner cfs-bl" />
                            <div className="cfs-corner cfs-br" />
                            <div className="qr-scan-line" />
                        </div>

                        <div className="camera-fullscreen-bottom">
                            <p className="camera-fullscreen-hint">Hold a QR code steady in the frame…</p>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Main render ───────────────────────────────────────────────────
    return (
        <div className="scanner-section">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Capture a Business Card</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
                Use your camera, upload an image, or scan a QR code to capture contact details.
            </p>

            {/* Step indicator */}
            {step !== 'idle' && (
                <div className="scan-step-indicator">
                    <div className="scan-step-dot done">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div className="scan-step-line" />
                    <div className={`scan-step-dot ${(['scanning-back', 'processing'] as string[]).includes(step) ? 'active' : ''}`}>2</div>
                    <div className="scan-step-labels">
                        <span>Front captured</span>
                        <span>Back (optional)</span>
                    </div>
                </div>
            )}

            {/* Tabs */}
            {(step === 'idle' || step === 'scanning-front') && (
                <div className="scanner-tabs">
                    <button className={`scanner-tab ${tab === 'camera' ? 'active' : ''}`} onClick={() => switchTab('camera')} id="tab-camera">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        Camera
                    </button>
                    <button className={`scanner-tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => switchTab('upload')} id="tab-upload">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        Upload
                    </button>
                    <button className={`scanner-tab ${tab === 'qr' ? 'active' : ''}`} onClick={() => switchTab('qr')} id="tab-qr">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                            <rect x="5" y="5" width="3" height="3" fill="currentColor" /><rect x="16" y="5" width="3" height="3" fill="currentColor" /><rect x="5" y="16" width="3" height="3" fill="currentColor" />
                        </svg>
                        QR Code
                    </button>
                    {eventId && (
                        <button className={`scanner-tab ${tab === 'csv' ? 'active' : ''}`} onClick={() => switchTab('csv')} id="tab-csv">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
                                <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>
                            </svg>
                            CSV
                        </button>
                    )}
                </div>
            )}

            {/* QR tab content */}
            {tab === 'qr' && renderQR()}

            {processing && (
                <div className="processing-bar">
                    <span className="spinner" />
                    Extracting contact details…
                </div>
            )}

            {/* Front scan */}
            {tab !== 'qr' && tab !== 'csv' && (step === 'idle' || step === 'scanning-front') && !processing && (
                tab === 'camera' ? renderCamera('front') : renderUpload('front')
            )}

            {/* Front done — ask about back */}
            {tab !== 'qr' && tab !== 'csv' && step === 'front-done' && !processing && (
                <div className="scan-step-card">
                    <div className="scan-step-card-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Front side captured ✓</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>Scan the back of the card for additional details, or proceed with just the front.</div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button className="btn btn-primary" onClick={() => { setStep('scanning-back'); if (tab === 'camera') startCamera(); else fileInputRef.current?.click(); }} id="btn-scan-back">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                Scan Back
                            </button>
                            <button className="btn btn-secondary" onClick={() => processImages(frontBase64, frontMime)} id="btn-skip-back">Skip — Front Only</button>
                        </div>
                    </div>
                    {frontPreview && <img src={frontPreview} alt="Front" style={{ width: 90, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
                </div>
            )}

            {/* Back scan */}
            {tab !== 'qr' && tab !== 'csv' && step === 'scanning-back' && !processing && (
                <div>
                    <div className="scan-back-header">
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Scanning back of card</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => { stopCamera(); setStep('front-done'); }}>← Back</button>
                    </div>
                    {tab === 'camera' ? renderCamera('back') : renderUpload('back')}
                </div>
            )}

            {/* Reset */}
            {tab !== 'qr' && tab !== 'csv' && (step === 'front-done' || step === 'scanning-back') && (
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={resetAll} id="btn-reset-scan">✕ Start Over</button>
                </div>
            )}

            {/* ── CSV tab ───────────────────────────────────────────── */}
            {tab === 'csv' && (
                <div style={{ paddingTop: 8 }}>
                    {/* Actions row */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', margin: 0 }}>
                            Import multiple prospects at once from a spreadsheet.
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setShowColGuide(v => !v)}>
                                {showColGuide ? 'Hide' : 'View'} Column Guide
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={downloadCSVTemplate}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
                                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                </svg>
                                Template
                            </button>
                        </div>
                    </div>

                    {/* Column guide */}
                    {showColGuide && (
                        <div style={{ marginBottom: 20, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                            <div style={{ background: 'var(--bg-secondary)', padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                Use these exact column headers in your CSV row 1
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr>
                                            {['Column Header', 'Field Name', 'Example'].map(h => (
                                                <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {CSV_COLUMNS.map(col => (
                                            <tr key={col.key} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '8px 14px' }}>
                                                    <span style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(99,102,241,0.08)', color: '#6366f1', padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.2)' }}>{col.key}</span>
                                                </td>
                                                <td style={{ padding: '8px 14px', color: 'var(--text-primary)' }}>{col.label}</td>
                                                <td style={{ padding: '8px 14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{col.example}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Success state */}
                    {csvResult && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span style={{ fontSize: 14, color: '#15803d', fontWeight: 500 }}>{csvResult.inserted} contact{csvResult.inserted !== 1 ? 's' : ''} imported successfully.</span>
                            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setCsvResult(null); }}>Import Another</button>
                        </div>
                    )}

                    {/* Drop zone */}
                    {!csvRows.length && !csvResult && (
                        <div
                            className={`upload-area${csvDragOver ? ' dragging' : ''}`}
                            onDragOver={e => { e.preventDefault(); setCsvDragOver(true); }}
                            onDragLeave={() => setCsvDragOver(false)}
                            onDrop={e => { e.preventDefault(); setCsvDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleCSVFile(f); }}
                            onClick={() => csvFileRef.current?.click()}
                            id="csv-drop-zone"
                        >
                            <span className="upload-icon">
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/>
                                    <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/>
                                </svg>
                            </span>
                            <div className="upload-title">Drop your CSV file here</div>
                            <div className="upload-subtitle">or click to browse · .csv files only</div>
                            <input ref={csvFileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }}
                                onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f); }} />
                        </div>
                    )}

                    {/* Preview */}
                    {csvRows.length > 0 && (() => {
                        const knownKeys = CSV_COLUMNS.map(c => c.key);
                        const unknownCols = csvHeaders.filter(h => !knownKeys.includes(h));
                        const matchedCols = csvHeaders.filter(h => knownKeys.includes(h));
                        return (
                            <div>
                                {unknownCols.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#b45309', marginBottom: 12 }}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                        <span>Unknown columns will be ignored: <strong>{unknownCols.join(', ')}</strong>. {matchedCols.length} column{matchedCols.length !== 1 ? 's' : ''} matched.</span>
                                    </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 600 }}>Preview <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: 12 }}>· {csvRows.length} row{csvRows.length !== 1 ? 's' : ''} · {matchedCols.length} matched columns</span></span>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setCsvRows([]); setCsvHeaders([]); if (csvFileRef.current) csvFileRef.current.value = ''; }}>✕ Clear</button>
                                </div>
                                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10, maxHeight: 260, overflowY: 'auto', marginBottom: 14 }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                        <thead>
                                            <tr>
                                                <th style={{ padding: '9px 13px', textAlign: 'left', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, position: 'sticky', top: 0 }}>#</th>
                                                {csvHeaders.map(h => (
                                                    <th key={h} style={{ padding: '9px 13px', textAlign: 'left', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', position: 'sticky', top: 0, color: knownKeys.includes(h) ? 'var(--text-muted)' : '#b45309' }}>{h}{!knownKeys.includes(h) ? ' ⚠' : ''}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {csvRows.slice(0, 20).map((row, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '7px 13px', color: 'var(--text-muted)', fontSize: 11 }}>{i + 1}</td>
                                                    {csvHeaders.map(h => (
                                                        <td key={h} style={{ padding: '7px 13px', color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }} title={row[h]}>{row[h] || '—'}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {csvRows.length > 20 && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, textAlign: 'right' }}>Showing first 20 of {csvRows.length} rows</p>}
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Ready to import <strong>{csvRows.length}</strong> contact{csvRows.length !== 1 ? 's' : ''}</span>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => { setCsvRows([]); setCsvHeaders([]); }} disabled={csvImporting}>Cancel</button>
                                        <button className="btn btn-primary" onClick={handleCSVImport} disabled={csvImporting || matchedCols.length === 0} id="btn-csv-import">
                                            {csvImporting ? <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Importing…</> : <>Import {csvRows.length} Contact{csvRows.length !== 1 ? 's' : ''}</>}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
