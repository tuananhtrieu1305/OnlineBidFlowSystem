import { useEffect, useRef, useState, type ReactNode } from 'react';
import { imageSource } from '../products/productApi';
import type { LiveLot, LiveSession } from './liveState';
import './showcase.css';

export default function ProductShowcase({
  lot,
  index,
  total,
  status,
  previews = [],
  onPreview,
  audience,
  children
}: {
  lot: LiveLot;
  index: number;
  total: number;
  status: LiveSession['status'];
  previews?: LiveLot[];
  onPreview?: (lot: LiveLot) => void;
  audience?: ReactNode;
  children: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const rotation = useRef(0);
  const drag = useRef<{ id: number; x: number; angle: number } | null>(null);
  const [held, setHeld] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(
    () => matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const source = imageSource(lot.imageUrl);
  const hasImage = !!source && source !== failed;
  const previousLot = useRef({ id: lot.id, source });
  const [departing, setDeparting] = useState<{ id: string; source: string } | null>(null);
  useEffect(() => {
    const previous = previousLot.current;
    previousLot.current = { id: lot.id, source };
    setDeparting(null);
    if (previous.id === lot.id || !previous.source || reduced) return;
    setDeparting({ id: previous.id, source: previous.source });
    const timer = setTimeout(() => setDeparting(null), 400);
    return () => clearTimeout(timer);
  }, [lot.id, source, reduced]);
  const stopped = held || !visible || hidden || reduced || !hasImage;

  function rotate(angle: number) {
    rotation.current = angle;
    photo.current?.style.setProperty('--showcase-drag-angle', angle + 'deg');
    stage.current?.style.setProperty(
      '--showcase-shadow-width',
      String(0.65 + 0.35 * Math.abs(Math.cos((angle * Math.PI) / 180)))
    );
  }
  function release() {
    drag.current = null;
    setHeld(false);
  }

  useEffect(() => {
    release();
    rotate(0);
  }, [lot.id, source]);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const motion = () => setReduced(preference.matches);
    const visibility = () => {
      setHidden(document.hidden);
      if (document.hidden) release();
    };
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (stage.current) observer.observe(stage.current);
    preference.addEventListener('change', motion);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', release);
    return () => {
      observer.disconnect();
      preference.removeEventListener('change', motion);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('blur', release);
    };
  }, []);

  return (
    <section className="product-showcase" aria-label="Không gian trưng bày sản phẩm">
      <div className="showcase-toolbar">
        <div>
          <span className="showcase-eyebrow">PHÒNG TRƯNG BÀY</span>
          <p>
            Sản phẩm {String(index + 1).padStart(2, '0')} <span>/ {total}</span>
          </p>
        </div>
      </div>
      <div className="showcase-room" data-testid="auction-room">
        <div className="showcase-theatre" data-testid="host-theatre">
          <div className="showcase-theatre-glow" aria-hidden="true" />
          <div className="showcase-feed">{children}</div>
          <div className="showcase-curtain showcase-curtain-left" aria-hidden="true">
            <div />
            <i />
          </div>
          <div className="showcase-curtain showcase-curtain-right" aria-hidden="true">
            <div />
            <i />
          </div>
          <div className="showcase-theatre-valance" aria-hidden="true">
            <span>ONLINEBIDFLOW</span>
          </div>
          <div className="showcase-product-light" aria-hidden="true">
            <div className="showcase-light-fixture">
              <b className="showcase-light-mount" />
              <i />
              <span />
            </div>
            <div className="showcase-light-beam" />
          </div>
          <div className="showcase-theatre-platform" aria-hidden="true">
            <i />
            <span />
          </div>
          <div
            ref={stage}
            className="showcase-stage"
            data-paused={stopped}
            data-held={held}
            data-testid="product-showcase-stage"
          >
            <div className="showcase-wall" aria-hidden="true" />
            <div className="showcase-floor" aria-hidden="true" />
            <div className="showcase-pedestal" aria-hidden="true">
              <div className="showcase-pedestal-top" />
              <div className="showcase-pedestal-front" />
              <span>ONLINEBIDFLOW</span>
            </div>
            <div className="showcase-product-shadow" aria-hidden="true" />
            {departing && (
              <div key={departing.id} className="showcase-retiring-photo" aria-hidden="true">
                <img src={departing.source} alt="" />
              </div>
            )}
            <div
              className="showcase-photo-position"
              ref={photo}
              key={lot.id + ':' + source}
              role={hasImage ? 'button' : undefined}
              tabIndex={hasImage ? 0 : undefined}
              aria-label={hasImage ? lot.name + ' · Kéo để xoay ảnh' : undefined}
              onPointerDown={(event) => {
                if (!hasImage || event.button !== 0 || !event.isPrimary) return;
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { id: event.pointerId, x: event.clientX, angle: rotation.current };
                setHeld(true);
              }}
              onPointerMove={(event) => {
                const active = drag.current;
                if (!active || active.id !== event.pointerId) return;
                rotate(active.angle + (event.clientX - active.x) * 0.65);
              }}
              onPointerUp={(event) => {
                if (!event.isPrimary) return;
                release();
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
              }}
              onPointerCancel={release}
              onLostPointerCapture={release}
              onKeyDown={(event) => {
                if (hasImage && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                  event.preventDefault();
                  rotate(rotation.current + (event.key === 'ArrowRight' ? 15 : -15));
                }
                if (hasImage && !reduced && (event.key === ' ' || event.key === 'Enter')) {
                  event.preventDefault();
                  setHeld(true);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  release();
                }
              }}
              onBlur={release}
            >
              <div className="showcase-photo-arrival">
                <div className="showcase-photo-manual">
                  <div className="showcase-photo-turntable">
                    <div className="showcase-photo-front">
                      {hasImage ? (
                        <img
                          src={source}
                          alt={lot.name}
                          decoding="async"
                          referrerPolicy="no-referrer"
                          onError={() => setFailed(source)}
                        />
                      ) : (
                        <div
                          className="showcase-photo-empty"
                          role="img"
                          aria-label={
                            (source ? 'Không tải được ảnh' : 'Chưa có ảnh') + ': ' + lot.name
                          }
                        >
                          <span aria-hidden="true">◇</span>
                          <p>{source ? 'Không tải được ảnh' : 'Chưa có ảnh sản phẩm'}</p>
                        </div>
                      )}
                      <span className="showcase-photo-glint" aria-hidden="true" />
                    </div>
                    <div className="showcase-photo-back" aria-hidden="true">
                      <b>b.</b>
                      <span>ONLINEBIDFLOW</span>
                      <small>ẢNH TRƯNG BÀY</small>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="showcase-lot-caption" key={lot.id}>
              <span>
                ĐANG TRƯNG BÀY · {String(index + 1).padStart(2, '0')} / {total}
              </span>
              <h2 aria-label={lot.name}>
                <button
                  type="button"
                  title="Xem thông tin sản phẩm"
                  aria-label={'Thông tin sản phẩm ' + lot.name}
                  onClick={() => onPreview?.(lot)}
                >
                  {lot.name}
                </button>
              </h2>
            </div>
            <div className="showcase-stage-caption" aria-hidden="true">
              <span>GALLERY / LIVE AUCTION</span>
              <i />
            </div>
          </div>
          <div className="showcase-previews" aria-label="Xem trước sản phẩm">
            {previews.slice(0, 2).map((item) => (
              <button
                key={item.id}
                type="button"
                className="showcase-mini"
                onClick={() => onPreview?.(item)}
                aria-label={'Xem sản phẩm ' + item.name}
              >
                <span className="showcase-mini-orbit">
                  {imageSource(item.imageUrl) ? (
                    <img
                      src={imageSource(item.imageUrl)}
                      alt=""
                      onError={(event) => {
                        event.currentTarget.style.visibility = 'hidden';
                      }}
                    />
                  ) : (
                    <span className="showcase-mini-empty">◇</span>
                  )}
                </span>
                <i className="showcase-mini-plinth" aria-hidden="true" />
                <span className="showcase-mini-name">{item.name}</span>
                <small>{item.status === 'SOLD' ? 'Đã bán' : 'Xem trước'}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="showcase-camera-vignette" aria-hidden="true" />
        <div className={'showcase-on-air is-' + status.toLowerCase()}>
          <i />{' '}
          {status === 'LIVE'
            ? 'SÂN KHẤU TRỰC TIẾP'
            : status === 'PAUSED'
              ? 'PHIÊN ĐANG TẠM DỪNG'
              : status === 'ENDED'
                ? 'PHIÊN ĐÃ KẾT THÚC'
                : 'CHỜ LÊN SÓNG'}{' '}
          <span>ONLINEBIDFLOW</span>
        </div>
        {audience && <div className="showcase-room-audience">{audience}</div>}
      </div>
      <div className="showcase-footer">
        <p>
          <span aria-hidden="true">✧</span> Ảnh sản phẩm · Ánh sáng trưng bày
        </p>
      </div>
    </section>
  );
}
