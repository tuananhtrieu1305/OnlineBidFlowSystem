import { useCallback, useEffect, useRef, useState } from 'react';
import client from '../../api/axiosClient';
import type { LiveSession } from './liveState';
import { listenLiveSignal, liveConnectionId, sendLive, type Signal } from './useLivestream';

type Peer = {
  epoch: string;
  pc: RTCPeerConnection;
  queue: Promise<void>;
  ice: RTCIceCandidateInit[];
};
export function useLiveVideo(session: LiveSession | undefined, host: boolean, connected: boolean) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const peers = useRef(new Map<string, Peer>());
  const reconcile = useRef<(ids: string[]) => void>(() => {});
  const local = useRef(stream);
  local.current = stream;
  const onStreamChange = useCallback((value: MediaStream | null) => setStream(value), []);
  const id = session?.id,
    generation = session?.mediaGeneration;
  const targets =
    session?.connections
      .map((c) => c.id)
      .sort()
      .join(',') ?? '';
  const publisher = session?.hostConnectionId;
  // Pausing an auction freezes bidding, not the host's camera preview/broadcast.
  const videoAvailable = !!session?.publisherReady && session.status !== 'ENDED';
  useEffect(() => {
    if (!id || !connected || session?.status === 'ENDED') return;
    if (host)
      sendLive({
        type: 'MEDIA_READY',
        ready: !!stream?.getVideoTracks().some((t) => t.readyState === 'live')
      });
  }, [id, host, stream, connected, publisher, session?.status]);
  useEffect(() => {
    if (
      !id ||
      !generation ||
      !connected ||
      !publisher ||
      !videoAvailable ||
      (host && !stream)
    ) {
      setRemote(null);
      return;
    }
    let disposed = false;
    let config: RTCConfiguration;
    const pendingIce = new Map<string, RTCIceCandidateInit[]>();
    const ready = client.get('/api/livestreams/' + id + '/ice-config').then((r) => {
      config = { iceServers: r.data.iceServers };
    });
    const emit = (
      target: string,
      kind: string,
      data: unknown,
      epoch = peers.current.get(target)?.epoch ?? ''
    ) => sendLive({ type: 'SIGNAL', target, kind, data, generation, epoch });
    const close = (key: string) => {
      peers.current.get(key)?.pc.close();
      peers.current.delete(key);
    };
    async function peer(key: string, epoch?: string) {
      await ready;
      if (disposed) throw new Error('Closed');
      let p = peers.current.get(key);
      if (p && (!epoch || p.epoch === epoch)) return p;
      if (p) {
        close(key);
        if (!host)
          setRemote((previous) => {
            previous?.getTracks().forEach((t) => t.stop());
            return null;
          });
      }
      const pc = new RTCPeerConnection(config);
      p = {
        epoch: epoch ?? crypto.randomUUID(),
        pc,
        queue: Promise.resolve(),
        ice: pendingIce.get(epoch ?? '') ?? []
      };
      pendingIce.delete(epoch ?? '');
      peers.current.set(key, p);
      pc.onicecandidate = (e) => {
        if (e.candidate) emit(key, 'ICE', e.candidate.toJSON(), p!.epoch);
      };
      pc.ontrack = (e) => {
        if (disposed || peers.current.get(key) !== p) return;
        setRemote((previous) => {
          const next = new MediaStream(previous?.getTracks() ?? []);
          if (!next.getTracks().some((t) => t.id === e.track.id)) next.addTrack(e.track);
          return next;
        });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') {
          setError('Video gián đoạn. Đang thử kết nối lại…');
          if (host) void offer(key, true);
          else emit(key, 'RESTART', {});
        }
        if (pc.connectionState === 'connected') setError('');
      };
      if (host && local.current)
        for (const track of local.current.getTracks()) pc.addTrack(track, local.current);
      return p;
    }
    async function offer(key: string, restart = false) {
      const p = await peer(key);
      p.queue = p.queue
        .then(async () => {
          if (disposed) return;
          // A viewer can finish JOIN after our first offer was sent. Its RESTART
          // request must receive that pending offer rather than wait indefinitely.
          if (p.pc.signalingState === 'have-local-offer') {
            emit(key, 'OFFER', p.pc.localDescription);
            return;
          }
          if (p.pc.signalingState !== 'stable') return;
          await p.pc.setLocalDescription(await p.pc.createOffer({ iceRestart: restart }));
          emit(key, 'OFFER', p.pc.localDescription);
          for (const sender of p.pc.getSenders())
            if (sender.track?.kind === 'video') {
              const params = sender.getParameters();
              params.encodings = params.encodings.length ? params.encodings : [{}];
              params.encodings.forEach((e) => {
                e.maxBitrate = 700000;
                e.maxFramerate = 15;
              });
              await sender.setParameters(params).catch(() => {});
            }
        })
        .catch(() => {
          if (!disposed) setError('Chưa truyền được video. Hãy thử kết nối lại.');
        });
      return p.queue;
    }
    const unsubscribe = listenLiveSignal((signal: Signal) => {
      if (signal.generation !== generation || disposed) return;
      void (async () => {
        if (signal.kind === 'RESTART' && host) {
          await offer(signal.sender, true);
          return;
        }
        if (!host && signal.sender !== publisher) return;
        if (signal.kind === 'ICE' && peers.current.get(signal.sender)?.epoch !== signal.epoch) {
          if (!host && signal.epoch && pendingIce.size < 20) {
            const list = pendingIce.get(signal.epoch) ?? [];
            if (list.length < 100) list.push(signal.data);
            pendingIce.set(signal.epoch, list);
          }
          return;
        }
        if (host && signal.epoch !== peers.current.get(signal.sender)?.epoch) return;
        const p = await peer(signal.sender, signal.epoch);
        p.queue = p.queue
          .then(async () => {
            if (disposed) return;
            if (signal.kind === 'ICE') {
              if (p.pc.remoteDescription) await p.pc.addIceCandidate(signal.data);
              else p.ice.push(signal.data);
            }
            if ((signal.kind === 'OFFER' && !host) || (signal.kind === 'ANSWER' && host)) {
              await p.pc.setRemoteDescription(signal.data);
              for (const candidate of p.ice.splice(0)) await p.pc.addIceCandidate(candidate);
              if (!host) {
                await p.pc.setLocalDescription(await p.pc.createAnswer());
                emit(signal.sender, 'ANSWER', p.pc.localDescription);
              }
            }
          })
          .catch(() => {
            if (!disposed) setError('Kết nối video bị gián đoạn.');
          });
      })().catch(() => {});
    });
    reconcile.current = (ids) => {
      if (!host) return;
      for (const key of peers.current.keys()) if (!ids.includes(key)) close(key);
      for (const target of ids) if (!peers.current.has(target)) void offer(target).catch(() => {});
    };
    reconcile.current(targets.split(',').filter(Boolean));
    if (!host) emit(publisher, 'RESTART', {});
    // Refresh expiring TURN credentials by rebuilding the peer connections before expiration.
    const renew = setTimeout(() => setRetry((v) => v + 1), 45 * 60 * 1000);
    return () => {
      disposed = true;
      reconcile.current = () => {};
      unsubscribe();
      clearTimeout(renew);
      for (const key of peers.current.keys()) close(key);
      setRemote(null);
    };
  }, [id, generation, connected, host, stream, publisher, retry, videoAvailable]);
  useEffect(() => {
    reconcile.current(targets.split(',').filter(Boolean));
  }, [targets]);
  return {
    remote,
    onStreamChange,
    error,
    reconnect: () => setRetry((v) => v + 1),
    ownConnection: liveConnectionId()
  };
}

export function RemoteLiveVideo({ stream }: { stream: MediaStream | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    if (video.current) {
      video.current.srcObject = stream;
      void video.current.play().catch(() => {});
    }
  }, [stream]);
  return (
    <section>
      <div className="live-stage">
        <video ref={video} autoPlay playsInline muted={muted} aria-label="Livestream từ host" />
        {!stream && <span>Đang chờ hình ảnh từ host…</span>}
      </div>
      <button
        type="button"
        className="live-secondary live-audio-toggle"
        aria-label={muted ? 'Bật âm thanh live' : 'Tắt âm thanh live'}
        title={muted ? 'Bật âm thanh live' : 'Tắt âm thanh live'}
        aria-pressed={!muted}
        onClick={() => {
          setMuted((v) => !v);
          void video.current?.play().catch(() => {});
        }}
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
          <path d="M11 5 6 9H3v6h3l5 4V5Z" />
          {muted ? (
            <path d="m17 9 5 6m0-6-5 6" />
          ) : (
            <>
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M19 5a10 10 0 0 1 0 14" />
            </>
          )}
        </svg>
      </button>
    </section>
  );
}
