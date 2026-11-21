import { useEffect, useRef, useState } from 'react';
import { studio } from './LiveShared';

export default function LiveCamera({
  title,
  onStreamChange
}: {
  title: string;
  onStreamChange: (stream: MediaStream | null) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const mounted = useRef(true);
  const [enabled, setEnabled] = useState(false);
  const [microphone, setMicrophone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    onStreamChange(stream.current ? new MediaStream(stream.current.getTracks()) : null);
  }, [enabled, microphone, onStreamChange]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
    };
  }, []);
  useEffect(() => {
    if (video.current && enabled) {
      video.current.srcObject = stream.current;
      void video.current.play().catch(() => {});
    }
  }, [enabled]);

  async function toggleCamera() {
    setError('');
    if (enabled) {
      stream.current?.getTracks().forEach((track) => track.stop());
      stream.current = null;
      setEnabled(false);
      setMicrophone(false);
      return;
    }
    setPending(true);
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 15, max: 15 } }
      });
      if (!mounted.current) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = next;
      next.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (!mounted.current || stream.current !== next) return;
          setEnabled(false);
          setMicrophone(false);
          setError('Camera đã ngắt kết nối. Kiểm tra thiết bị rồi bật lại.');
          stream.current?.getTracks().forEach((item) => item.stop());
          stream.current = null;
        };
      });
      setEnabled(true);
    } catch {
      if (mounted.current)
        setError('Chưa mở được camera. Kiểm tra quyền truy cập và thiết bị, rồi thử lại.');
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  async function toggleMicrophone() {
    if (!stream.current) return;
    setError('');
    if (microphone) {
      stream.current.getAudioTracks().forEach((track) => {
        track.stop();
        stream.current?.removeTrack(track);
      });
      setMicrophone(false);
      return;
    }
    setPending(true);
    try {
      const next = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current || !stream.current) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      next.getAudioTracks().forEach((track) => {
        track.onended = () => {
          if (!mounted.current || !stream.current?.getAudioTracks().includes(track)) return;
          stream.current.removeTrack(track);
          setMicrophone(false);
          setError('Mic đã ngắt kết nối. Kiểm tra thiết bị rồi bật lại.');
        };
        stream.current?.addTrack(track);
      });
      setMicrophone(true);
    } catch {
      if (mounted.current) setError('Chưa mở được mic. Kiểm tra quyền truy cập và thiết bị.');
    } finally {
      if (mounted.current) setPending(false);
    }
  }

  return (
    <section aria-label="Camera của host">
      <div className="live-stage">
        {enabled ? (
          <video ref={video} autoPlay playsInline muted aria-label="Camera xem trước của bạn" />
        ) : (
          <img src={studio} alt="Ảnh minh họa khi camera chưa được bật" />
        )}
        <span>{enabled ? 'Camera xem trước' : 'Ảnh minh họa'}</span>
        <div className="live-stage-caption">
          <strong>{title}</strong>
          <small>Xem trước trên thiết bị này</small>
        </div>
      </div>
      <div className="live-actions live-camera-controls">
        <button
          type="button"
          className="live-secondary"
          aria-label={enabled ? 'Tắt camera' : 'Bật camera'}
          title={enabled ? 'Tắt camera' : 'Bật camera'}
          aria-pressed={enabled}
          disabled={pending}
          onClick={() => void toggleCamera()}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="6" width="12" height="12" rx="2" />
            <path d="m15 10 6-4v12l-6-4" />
            {!enabled && <path d="m2 2 20 20" />}
          </svg>
        </button>
        <button
          type="button"
          className="live-secondary"
          aria-label={microphone ? 'Tắt mic' : 'Bật mic'}
          title={microphone ? 'Tắt mic' : 'Bật mic'}
          aria-pressed={microphone}
          disabled={!enabled || pending}
          onClick={() => void toggleMicrophone()}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8" />
            {!microphone && <path d="m2 2 20 20" />}
          </svg>
        </button>
      </div>
      {error && (
        <p className="live-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
