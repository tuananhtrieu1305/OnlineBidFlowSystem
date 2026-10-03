import CollectionArtwork from '../features/auth/components/CollectionArtwork';
import {DiscoveryList} from '../features/auctions/discovery/Discovery';

export default function HomePage() {
  return (
    <main id="main-content" className="guest-home" tabIndex={-1}>
      <header className="guest-topbar"><span>Khám phá</span><span className="guest-topnote">Những món đồ. Những câu chuyện.</span></header>
      <section className="guest-hero" aria-labelledby="discovery-title">
        <div className="guest-hero-copy">
          <p className="guest-kicker">KHÁM PHÁ · LỰA CHỌN · SỞ HỮU</p>
          <h1 id="discovery-title">Món đồ đặc biệt.<br /><em>Lựa chọn của bạn.</em></h1>
          <p>Mỗi món đồ đều có một câu chuyện. Khám phá những phiên đấu giá và tìm điều xứng đáng với bộ sưu tập của bạn.</p>
          <button className="guest-text-link" onClick={() => document.getElementById('auction-list')?.scrollIntoView()}>Khám phá các phiên <span aria-hidden="true">↓</span></button>
        </div>
        <figure className="guest-hero-art"><CollectionArtwork /><figcaption><span>GÓC SƯU TẦM</span><span>Âm thanh của thời gian · Ảnh minh họa</span></figcaption></figure>
      </section>
      <section id="auction-list" className="guest-auctions" aria-labelledby="auction-title">
        <div className="guest-section-heading"><div><p className="guest-kicker">TÌM PHIÊN CỦA BẠN</p><h2 id="auction-title">Khám phá phiên đấu giá</h2></div><span className="guest-public">Dành cho cộng đồng</span></div>
        <DiscoveryList />
      </section>
      <section className="guest-guide" aria-labelledby="guide-title">
        <div className="guest-section-heading"><h2 id="guide-title">Từ khám phá đến sở hữu</h2><span>Ba bước để bắt đầu</span></div>
        <ol>
          <li><span>01</span><div><h3>Tạo tài khoản</h3><p>Một tài khoản, một ví Coin riêng để bắt đầu hành trình.</p></div></li>
          <li><span>02</span><div><h3>Chuẩn bị Coin</h3><p>Nạp Coin giả lập và theo dõi số dư trước khi tham gia.</p></div></li>
          <li><span>03</span><div><h3>Chọn phiên, đặt giá</h3><p>Tìm hiểu sản phẩm và quy tắc đấu giá thường hoặc đấu giá kín.</p></div></li>
        </ol>
      </section>
      <footer className="guest-footer"><span>OnlineBidFlow · Không gian đấu giá của bạn</span><span>Coin chỉ có giá trị trong hệ thống.</span></footer>
    </main>
  );
}
