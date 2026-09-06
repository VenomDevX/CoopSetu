'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Face enrolment and verification in the browser.
 *
 * The backend for this has existed since 0072 — a 128-dimensional descriptor,
 * Euclidean distance, threshold 0.6 — and face-api.js plus its three weight
 * files have shipped in the repo the whole time. Nothing ever imported them, so
 * the endpoint was reachable only by curl and the feature did not exist as far
 * as a user was concerned.
 *
 * face-api.js is loaded dynamically rather than imported at the top. It pulls
 * in a TensorFlow build of several megabytes, and importing it statically would
 * put that in the bundle of every page that merely links to attendance.
 */

type Mode = 'register' | 'verify';

interface Props {
  mode: Mode;
  /** Required for verification: the session the mark belongs to. */
  sessionId?: string;
  /** Whose face. Staff enrolling on someone's behalf pass this explicitly. */
  traineeId?: string;
  onDone?: (result: { verified: boolean; message: string }) => void;
}

const MODEL_URL = '/models';

export function FaceCapture({ mode, sessionId, traineeId, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const faceapiRef = useRef<any>(null);

  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'working' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setStatus('loading');
    setMessage('Loading face models…');
    try {
      const faceapi = await import('face-api.js');
      faceapiRef.current = faceapi;

      // Only the three nets this flow needs. Loading the full set would pull
      // down age/gender/expression weights nothing here uses.
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);

      setMessage('Starting camera…');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus('ready');
      setMessage(mode === 'register' ? 'Look straight at the camera, then capture.' : 'Look at the camera to check in.');
    } catch (err: any) {
      setStatus('error');
      // Distinguish the three failures a user can actually act on: no camera
      // hardware, permission refused, and anything else.
      setMessage(
        err?.name === 'NotAllowedError'
          ? 'Camera permission was refused. Allow it in your browser and try again.'
          : err?.name === 'NotFoundError'
            ? 'No camera was found on this device.'
            : `Could not start the camera: ${err?.message ?? 'unknown error'}`,
      );
    }
  }, [mode]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const capture = useCallback(async () => {
    const faceapi = faceapiRef.current;
    const video = videoRef.current;
    if (!faceapi || !video) return;

    setStatus('working');
    setMessage('Reading face…');

    const detection = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setStatus('ready');
      setMessage('No face detected. Move closer, and check the lighting.');
      return;
    }

    // The descriptor is a Float32Array; the API expects a plain 128-length
    // array of numbers, and the service rejects anything else.
    const embedding = Array.from(detection.descriptor as Float32Array);
    if (embedding.length !== 128) {
      setStatus('error');
      setMessage(`Unexpected descriptor length ${embedding.length}; expected 128.`);
      return;
    }

    try {
      const res = await fetch('/api/v1/attendance/face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: mode,
          trainee_id: traineeId,
          session_id: sessionId,
          embedding,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setStatus('ready');
        setMessage(json?.error || 'That did not work. Try again.');
        return;
      }

      stopCamera();
      setStatus('done');
      const verified = json?.data?.verified !== false;
      const done =
        mode === 'register'
          ? 'Face registered. It can now be used to check in.'
          : verified
            ? 'Checked in.'
            : 'That face did not match the registered one.';
      setMessage(done);
      onDone?.({ verified, message: done });
    } catch (err: any) {
      setStatus('error');
      setMessage(`Could not reach the server: ${err?.message ?? 'unknown error'}`);
    }
  }, [mode, sessionId, traineeId, onDone, stopCamera]);

  return (
    <div className="border border-border rounded bg-background p-5 space-y-4">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <Camera className="w-3.5 h-3.5" />
        {mode === 'register' ? 'Register face' : 'Face check-in'}
      </div>

      <div className="relative rounded overflow-hidden border border-border bg-black aspect-[4/3]">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`w-full h-full object-cover ${status === 'idle' || status === 'done' ? 'opacity-0' : 'opacity-100'}`}
        />
        {(status === 'idle' || status === 'done') && (
          <div className="absolute inset-0 flex items-center justify-center">
            {status === 'done' ? (
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            ) : (
              <Camera className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
        )}
      </div>

      {message && (
        <p
          className={`text-xs font-mono flex items-start gap-2 ${
            status === 'error' ? 'text-red-500' : status === 'done' ? 'text-green-500' : 'text-muted-foreground'
          }`}
        >
          {status === 'error' && <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
          {message}
        </p>
      )}

      <div className="flex gap-2">
        {status === 'idle' && (
          <Button onClick={start} data-native-tap className="rounded font-mono text-xs uppercase w-full">
            <Camera className="w-4 h-4 mr-2" /> Start camera
          </Button>
        )}
        {(status === 'ready' || status === 'working') && (
          <Button
            onClick={capture}
            disabled={status === 'working'}
            data-native-tap
            className="rounded font-mono text-xs uppercase w-full"
          >
            {status === 'working' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {mode === 'register' ? 'Capture and register' : 'Check in'}
          </Button>
        )}
        {(status === 'error' || status === 'done') && (
          <Button
            variant="outline"
            onClick={() => { setStatus('idle'); setMessage(''); }}
            data-native-tap
            className="rounded font-mono text-xs uppercase w-full"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Again
          </Button>
        )}
        {status === 'loading' && (
          <div className="w-full flex items-center justify-center gap-2 font-mono text-xs text-muted-foreground py-2">
            <Loader2 className="w-4 h-4 animate-spin" /> {message}
          </div>
        )}
      </div>
    </div>
  );
}
