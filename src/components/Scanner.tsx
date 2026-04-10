'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ExtractedContact } from '@/lib/gemini';

interface ScannerProps {
    onExtracted: (data: ExtractedContact, frontBase64: string, backBase64: string | null) => void;
}

type ScanStep = 'idle' | 'scanning-front' | 'front-done' | 'scanning-back' | 'processing';

export default function Scanner({ onExtracted }: ScannerProps) {
    const [tab, setTab] = useState<'camera' | 'upload'>('camera');
    const [step, setStep] = useState<ScanStep>('idle');
    const [cameraActive, setCameraActive] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [frontPreview, setFrontPreview] = useState<string | null>(null);
    const [backPreview, setBackPreview] = useState<string | null>(null);
    const [frontBase64, setFrontBase64] = useState<string>('');
    const [frontMime, setFrontMime] = useState<string>('image/jpeg');
    const [backBase64, setBackBase64] = useState<string>('');
    const [backMime, setBackMime] = useState<string>('image/jpeg');
    const [dragOver, setDragOver] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (cameraActive && videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
        }
    }, [cameraActive]);

    const startCamera = useCallback(async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } },
            });
            streamRef.current = stream;
            setCameraActive(true);
        } catch {
            toast.error('Unable to access camera. Please allow camera permission or use file upload.');
        }
    }, []);

    const stopCamera = useCallback(() => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCameraActive(false);
    }, []);

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
            if (bBase64) {
                body.backImage = bBase64;
                body.backMimeType = bMime || 'image/jpeg';
            }
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
        stopCamera();
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    // ─── Render helpers ───────────────────────────────────────────────

    function renderCamera(side: 'front' | 'back') {
        const isActive = cameraActive;
        const preview = side === 'front' ? frontPreview : backPreview;

        if (preview && !isActive) {
            return (
                <div style={{ textAlign: 'center' }}>
                    <img src={preview} alt={`${side} of card`} className="preview-image" />
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                        if (side === 'front') { setFrontPreview(null); setStep('idle'); }
                        else { setBackPreview(null); setStep('front-done'); }
                    }}>
                        Retake Photo
                    </button>
                </div>
            );
        }

        return (
            <div>
                {!isActive && (
                    <div style={{ textAlign: 'center', padding: '48px 0' }}>
                        <div style={{ fontSize: 48, marginBottom: 20, color: 'var(--text-muted)' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15 }}>
                            {side === 'front' ? 'Position the front of the card in view' : 'Now position the back of the card'}
                        </p>
                        <button className="btn btn-primary btn-lg" onClick={() => { setStep(side === 'front' ? 'scanning-front' : 'scanning-back'); startCamera(); }} id={`btn-start-camera-${side}`}>
                            Start Camera
                        </button>
                    </div>
                )}
                {isActive && (
                    <>
                        <div className="camera-container">
                            <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                            <div className="camera-guide" />
                            <div className="camera-overlay">
                                <button className="capture-btn" onClick={capturePhoto} id={`btn-capture-${side}`} aria-label="Capture">
                                    <div className="capture-btn-inner" />
                                </button>
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

    function renderUpload(side: 'front' | 'back') {
        const preview = side === 'front' ? frontPreview : backPreview;
        if (preview) {
            return (
                <div style={{ textAlign: 'center' }}>
                    <img src={preview} alt={`${side} of card`} className="preview-image" />
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                        if (side === 'front') { setFrontPreview(null); setStep('idle'); }
                        else { setBackPreview(null); setStep('front-done'); }
                        if (fileInputRef.current) fileInputRef.current.value = '';
                    }}>
                        Upload Another
                    </button>
                </div>
            );
        }
        return (
            <div
                className={`upload-area ${dragOver ? 'dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => handleDrop(e, side)}
                id={`upload-area-${side}`}
            >
                <span className="upload-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </span>
                <div className="upload-title">
                    {side === 'front' ? 'Drop the front of your card here' : 'Drop the back of your card here'}
                </div>
                <div className="upload-subtitle">or click to browse · Supports JPG, PNG, WEBP, HEIC</div>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleFileChange(e.target.files?.[0] || null, side)}
                />
            </div>
        );
    }

    // ─── Main render ──────────────────────────────────────────────────

    const currentSide = (step === 'scanning-back' || (step === 'front-done' && backPreview)) ? 'back' : 'front';

    return (
        <div className="scanner-section">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Scan a Business Card</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
                Use your camera or upload an image — AI will extract all contact details instantly.
            </p>

            {/* Progress steps – shown for all scanning states */}
            {step !== 'idle' && (
                <div className="scan-step-indicator">
                    <div className="scan-step-dot done">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div className="scan-step-line" />
                    <div className={`scan-step-dot ${(['scanning-back', 'processing'] as string[]).includes(step) ? 'active' : ''}`}>
                        2
                    </div>
                    <div className="scan-step-labels">
                        <span>Front scanned</span>
                        <span>Back (optional)</span>
                    </div>
                </div>
            )}

            {/* Tabs — only show when choosing scan side */}
            {(step === 'idle' || step === 'scanning-front') && (
                <div className="scanner-tabs">
                    <button className={`scanner-tab ${tab === 'camera' ? 'active' : ''}`} onClick={() => { setTab('camera'); resetAll(); }} id="tab-camera">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        Camera
                    </button>
                    <button className={`scanner-tab ${tab === 'upload' ? 'active' : ''}`} onClick={() => { setTab('upload'); resetAll(); }} id="tab-upload">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                        Upload
                    </button>
                </div>
            )}

            {processing && (
                <div className="processing-bar">
                    <span className="spinner" />
                    Analyzing card with AI… This may take a few seconds.
                </div>
            )}

            {/* ── Front scan ── */}
            {(step === 'idle' || step === 'scanning-front') && !processing && (
                tab === 'camera' ? renderCamera('front') : renderUpload('front')
            )}

            {/* ── Front done — ask about back ── */}
            {step === 'front-done' && !processing && (
                <div className="scan-step-card">
                    <div className="scan-step-card-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <div>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Front side scanned ✓</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16 }}>
                            Would you also like to scan the back of the card? It may contain extra details.
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <button
                                className="btn btn-primary"
                                onClick={() => {
                                    setStep('scanning-back');
                                    if (tab === 'camera') startCamera();
                                    else if (fileInputRef.current) fileInputRef.current.click();
                                }}
                                id="btn-scan-back"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                Scan Back Too
                            </button>
                            <button
                                className="btn btn-secondary"
                                onClick={() => processImages(frontBase64, frontMime)}
                                id="btn-skip-back"
                            >
                                Skip — Front Only
                            </button>
                        </div>
                    </div>
                    {frontPreview && (
                        <img src={frontPreview} alt="Front" style={{ width: 90, height: 56, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                    )}
                </div>
            )}

            {/* ── Back scan ── */}
            {step === 'scanning-back' && !processing && (
                <div>
                    <div className="scan-back-header">
                        <span style={{ fontWeight: 600, fontSize: 14 }}>📸 Now scan the back of the card</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => { stopCamera(); setStep('front-done'); }}>← Back</button>
                    </div>
                    {tab === 'camera' ? renderCamera('back') : (
                        <>
                            {renderUpload('back')}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={e => handleFileChange(e.target.files?.[0] || null, 'back')}
                            />
                        </>
                    )}
                </div>
            )}

            {/* Reset button */}
            {(step === 'front-done' || step === 'scanning-back') && (
                <div style={{ marginTop: 12, textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm" onClick={resetAll} id="btn-reset-scan">✕ Start Over</button>
                </div>
            )}

            {/* Hidden file input for back upload when upload tab */}
            {step === 'scanning-back' && tab === 'upload' && (
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => handleFileChange(e.target.files?.[0] || null, currentSide as 'front' | 'back')}
                />
            )}
        </div>
    );
}
