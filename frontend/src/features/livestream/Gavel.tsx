import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { coin } from './LiveShared';
import hammer from './assets/gavel-hammer.png';
import base from './assets/gavel-base.png';

const playedResults = new Set<string>();
const strikeDuration = 1350;
const holdDuration = 700;
const exitDuration = 250;
type Sale = { id: string; winnerName: string; amount: string; productName: string };
type Props = Omit<Sale, 'id'> & { resultId: string | null };

export default function Gavel({ resultId, winnerName, amount, productName }: Props) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [phase, setPhase] = useState<'striking' | 'holding' | 'leaving'>('striking');
  const audio = useRef<AudioContext>();
  const previous = useRef(resultId);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  function playKnocks() {
    const context = audio.current;
    if (context?.state !== 'running') return;
    const firstHit = context.currentTime + 0.2;
    for (let hit = 0; hit < 3; hit++) {
      const when = firstHit + hit * 0.45;
      const samples = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * 0.2),
        context.sampleRate
      );
      const data = samples.getChannelData(0);
      for (let index = 0; index < data.length; index++) {
        const time = index / context.sampleRate;
        data[index] =
          (Math.sin(2 * Math.PI * 145 * time) * 0.65 + (Math.random() * 2 - 1) * 0.35) *
          Math.exp(-time * 32);
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const volume = context.createGain();
      source.buffer = samples;
      filter.type = 'lowpass';
      filter.frequency.value = 1050;
      volume.gain.value = hit === 2 ? 0.65 : 0.45;
      source.connect(filter).connect(volume).connect(context.destination);
      source.start(when);
    }
  }

  useEffect(() => {
    if (resultId && previous.current !== resultId && !playedResults.has(resultId)) {
      playedResults.add(resultId);
      timers.current.forEach(clearTimeout);
      // Capture the committed sale so moving to the next lot cannot change this announcement.
      setSale({ id: resultId, winnerName, amount, productName });
      setPhase('striking');
      playKnocks();
      timers.current = [
        setTimeout(() => setPhase('holding'), strikeDuration),
        setTimeout(() => setPhase('leaving'), strikeDuration + holdDuration),
        setTimeout(() => setSale(null), strikeDuration + holdDuration + exitDuration)
      ];
    }
    previous.current = resultId;
  }, [resultId, winnerName, amount, productName]);

  useEffect(() => {
    // Electron permits autoplay; browsers unlock audio on the first room interaction.
    function unlockAudio() {
      try {
        audio.current ??= new AudioContext();
        if (audio.current.state === 'suspended') void audio.current.resume().catch(() => {});
      } catch {
        // An unavailable audio device must not interrupt the sale announcement.
      }
    }
    unlockAudio();
    document.addEventListener('pointerdown', unlockAudio, true);
    document.addEventListener('keydown', unlockAudio, true);
    return () => {
      document.removeEventListener('pointerdown', unlockAudio, true);
      document.removeEventListener('keydown', unlockAudio, true);
      timers.current.forEach(clearTimeout);
      const context = audio.current;
      audio.current = undefined;
      void context?.close().catch(() => {});
    };
  }, []);

  useEffect(() => {
    for (const src of [hammer, base]) {
      const preload = new Image();
      preload.src = src;
      void preload.decode().catch(() => {});
    }
  }, []);

  return (
    <>
      {sale &&
        createPortal(
          <div
            className={'live-sale-overlay' + (phase === 'leaving' ? ' is-leaving' : '')}
            data-testid="live-sale-overlay"
          >
            <section className="live-sale-card" role="status" aria-live="polite" aria-atomic="true">
              <p className="live-sale-kicker">CHỐT GIÁ THÀNH CÔNG</p>
              <div
                key={sale.id}
                className="live-gavel-scene"
                data-striking={phase === 'striking'}
                role="img"
                aria-label="Búa gỗ gõ ba lần khi chốt người thắng"
              >
                <img className="live-gavel-base" src={base} alt="" />
                <img className="live-gavel-hammer" src={hammer} alt="" />
                <span className="live-gavel-impact" aria-hidden="true" />
                <span className="live-gavel-ripple" aria-hidden="true" />
              </div>
              <p className="live-sale-label">Người thắng</p>
              <h2>{sale.winnerName}</h2>
              <p className="live-sale-product">{sale.productName}</p>
              <p className="live-sale-price">{coin(sale.amount)}</p>
            </section>
          </div>,
          document.body
        )}
    </>
  );
}
