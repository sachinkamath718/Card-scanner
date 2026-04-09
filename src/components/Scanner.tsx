'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { ExtractedContact } from '@/lib/gemini';

interface ScannerProps {
    onExtracted: (data: ExtractedContact, imageBase64: string) => void;
}

export default function Scanner({ onExtracted }: ScannerProps) {
    const [tab, setTab] = useState<'camera' | 'upload'>('camera');
    const [cameraActive, setCameraActive] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const [dragOver, setDragOver] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Assign stream to video element after it renders in the DOM
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
            // Set cameraActive=true FIRST so the <video> renders,
            // then the useEffect above assigns srcObject once the element exists
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
        const base64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
        setPreview(canvas.toDataURL('image/jpeg', 0.9));
        stopCamera();
        await processImage(base64, 'image/jpeg');
    }, [stopCamera]);

    async function processImage(base64: string, mimeType: string) {
        setProcessing(true);
        try {
            const res = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64, mimeType }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            toast.success('Card scanned successfully!');
            onExtracted(json.data, base64);
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Scan failed';
            toast.error(msg);
        } finally {
            setProcessing(false);
        }
    }

    function handleFileChange(file: File | null) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            const dataUrl = e.target?.result as string;
            setPreview(dataUrl);
            const base64 = dataUrl.split(',')[1];
            const mimeType = file.type || 'image/jpeg';
            await processImage(base64, mimeType);
        };
        reader.readAsDataURL(file);
    }

    function handleDrop(e: React.DragEvent) {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleFileChange(file);
    }

    function resetScan() {
        setPreview(null);
        stopCamera();
    }

    return (
        <div className="scanner-section">
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>📇 Scan a Business Card</h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24 }}>
                Use your camera or upload an image — AI will extract all contact details instantly.
            </p>

            <div className="scanner-tabs">
                <button
                    className={`scanner-tab ${tab === 'camera' ? 'active' : ''}`}
                    onClick={() => { setTab('camera'); resetScan(); }}
                    id="tab-camera"
                >
                    📷 Camera
                </button>
                <button
                    className={`scanner-tab ${tab === 'upload' ? 'active' : ''}`}
                    onClick={() => { setTab('upload'); resetScan(); stopCamera(); }}
                    id="tab-upload"
                >
                    📁 Upload
                </button>
            </div>

            {processing && (
                <div className="processing-bar">
                    <span className="spinner" />
                    Analyzing card with AI... This may take a few seconds.
                </div>
            )}

            {tab === 'camera' && (
                <div>
                    {!cameraActive && !preview && (
                        <div style={{ textAlign: 'center', padding: '48px 0' }}>
                            <div style={{ fontSize: 64, marginBottom: 20 }}>📷</div>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: 15 }}>
                                Position the business card in view and capture
                            </p>
                            <button className="btn btn-primary btn-lg" onClick={startCamera} id="btn-start-camera">
                                Start Camera
                            </button>
                        </div>
                    )}

                    {cameraActive && (
                        <>
                            <div className="camera-container">
                                <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
                                <div className="camera-guide" />
                                <div className="camera-overlay">
                                    <button className="capture-btn" onClick={capturePhoto} id="btn-capture" aria-label="Capture">
                                        <div className="capture-btn-inner" />
                                    </button>
                                </div>
                            </div>
                            <div style={{ textAlign: 'center', marginTop: 16 }}>
                                <button className="btn btn-ghost btn-sm" onClick={stopCamera}>✕ Cancel</button>
                            </div>
                        </>
                    )}

                    {preview && !cameraActive && (
                        <div style={{ textAlign: 'center' }}>
                            <img src={preview} alt="Captured card" className="preview-image" />
                            <button className="btn btn-secondary btn-sm" onClick={() => { setPreview(null); }}>
                                Retake Photo
                            </button>
                        </div>
                    )}
                </div>
            )}

            {tab === 'upload' && (
                <div>
                    {preview ? (
                        <div style={{ textAlign: 'center' }}>
                            <img src={preview} alt="Uploaded card" className="preview-image" />
                            <button className="btn btn-secondary btn-sm" onClick={() => setPreview(null)}>
                                Upload Another
                            </button>
                        </div>
                    ) : (
                        <div
                            className={`upload-area ${dragOver ? 'dragging' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            id="upload-area"
                        >
                            <span className="upload-icon">🖼️</span>
                            <div className="upload-title">Drop your card image here</div>
                            <div className="upload-subtitle">or click to browse · Supports JPG, PNG, WEBP, HEIC</div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={e => handleFileChange(e.target.files?.[0] || null)}
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
