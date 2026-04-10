'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ExtractedContact } from '@/lib/gemini';
import { parseQRCode } from '@/lib/qrParser';

interface ScannerProps {
    onExtracted: (data: ExtractedContact, frontBase64: string, backBase64: string | null) => void;
}

type ScanStep = 'idle' | 'scanning-front' | 'front-done' | 'scanning-back' | 'processing';
type ScanTab = 'camera' | 'upload' | 'qr';

export default function Scanner({ onExtracted }: ScannerProps) {
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
    const [qrFetching, setQrFetching] = useState(false);

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

    async function handleQRDetected(data: string) {
        const result = parseQRCode(data);
        setQrResult(data);

        if (result.type === 'url') {
            // Fetch the URL and extract contact info from the page
            setQrFetching(true);
            try {
                const res = await fetch('/api/fetch-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: data }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error);
                toast.success('Contact details extracted from the page!');
                onExtracted(json.data, '', null);
            } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Could not fetch the URL');
                // Still open the form with empty fields so user can fill manually
                onExtracted(result.contact as ExtractedContact, '', null);
            } finally {
                setQrFetching(false);
            }
        } else if (result.type === 'vcard') {
            toast.success('vCard QR code detected! Contact details extracted.');
            onExtracted(result.contact as ExtractedContact, '', null);
        } else {
            toast('QR code read. Please fill in any missing details.', { icon: '📋' });
            onExtracted(result.contact as ExtractedContact, '', null);
        }
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
                {cameraActive && (
                    <>
                        <div className="camera-container">
                            <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                            <div className="camera-guide" />
                            <div className="camera-overlay">
                                <button className="capture-btn" onClick={capturePhoto} id={`btn-capture-${side}`} aria-label="Capture"><div className="capture-btn-inner" /></button>
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <button className="btn btn-ghost btn-sm" onClick={stopCamera}>✕ Cancel</button>
                        </div>
                    </>
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
            const isUrl = /^https?:\/\//i.test(qrResult);
            return (
                <div className="qr-result-card">
                    <div className={`qr-result-icon ${qrFetching ? '' : ''}`}>
                        {qrFetching ? (
                            <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                            {qrFetching ? 'Fetching contact details…' : 'QR Code Scanned'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', maxWidth: 320 }}>
                            {qrFetching
                                ? `Reading page at ${qrResult.length > 60 ? qrResult.slice(0, 60) + '…' : qrResult}`
                                : isUrl
                                    ? `URL: ${qrResult.length > 80 ? qrResult.slice(0, 80) + '…' : qrResult}`
                                    : qrResult.length > 120 ? qrResult.slice(0, 120) + '…' : qrResult
                            }
                        </div>
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
                {qrActive && (
                    <>
                        <div className="camera-container qr-container">
                            <video ref={qrVideoRef} autoPlay playsInline muted className="camera-video" />
                            <div className="qr-guide">
                                <div className="qr-guide-corner qr-tl" />
                                <div className="qr-guide-corner qr-tr" />
                                <div className="qr-guide-corner qr-bl" />
                                <div className="qr-guide-corner qr-br" />
                                <div className="qr-scan-line" />
                            </div>
                        </div>
                        <div style={{ textAlign: 'center', marginTop: 16 }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 12 }}>Hold a QR code steady in the frame…</p>
                            <button className="btn btn-ghost btn-sm" onClick={stopQR}>✕ Cancel</button>
                        </div>
                    </>
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
                    <button className={`scanner-tab ${(tab as string) === 'qr' ? 'active' : ''}`} onClick={() => switchTab('qr')} id="tab-qr">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                            <rect x="5" y="5" width="3" height="3" fill="currentColor" /><rect x="16" y="5" width="3" height="3" fill="currentColor" /><rect x="5" y="16" width="3" height="3" fill="currentColor" />
                        </svg>
                        QR Code
                    </button>
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
            {tab !== 'qr' && (step === 'idle' || step === 'scanning-front') && !processing && (
                tab === 'camera' ? renderCamera('front') : renderUpload('front')
            )}

            {/* Front done — ask about back */}
            {tab !== 'qr' && step === 'front-done' && !processing && (
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
            {tab !== 'qr' && step === 'scanning-back' && !processing && (
                <div>
                    <div className="scan-back-header">
                        <span style={{ fontWeight: 600, fontSize: 14 }}>Scanning back of card</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => { stopCamera(); setStep('front-done'); }}>← Back</button>
                    </div>
                    {tab === 'camera' ? renderCamera('back') : renderUpload('back')}
                </div>
            )}

            {/* Reset */}
            {tab !== 'qr' && (step === 'front-done' || step === 'scanning-back') && (
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={resetAll} id="btn-reset-scan">✕ Start Over</button>
                </div>
            )}
        </div>
    );
}
