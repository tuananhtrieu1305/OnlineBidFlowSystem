export default function CollectionArtwork() {
  return (
    <svg viewBox="0 0 600 450" role="img" aria-label="Minh họa bộ sưu tập đĩa than và máy phát nhạc" className="collection-art">
      <defs>
        <linearGradient id="paper" x2="0" y2="1"><stop stopColor="#eeece1"/><stop offset="1" stopColor="#d9d9cb"/></linearGradient>
        <linearGradient id="wood" x2="1" y2="1"><stop stopColor="#b98458"/><stop offset="1" stopColor="#8d5f3d"/></linearGradient>
      </defs>
      <rect width="600" height="450" fill="url(#paper)"/>
      <path d="M0 334 600 284v166H0Z" fill="#c8cbbb"/>
      <path d="M384 0H600v279L384 298Z" fill="#e5e5d8"/>
      <g transform="translate(74 39) rotate(-9 110 140)">
        <rect x="5" y="8" width="204" height="257" rx="2" fill="#a3a998" opacity=".25"/>
        <rect width="204" height="257" rx="2" fill="#145c53"/>
        <circle cx="104" cy="113" r="71" fill="#d7cda9"/>
        <path d="M33 124c40-71 80 61 144-24M37 142c45-63 83 49 137-23" fill="none" stroke="#145c53" strokeWidth="8"/>
        <text x="22" y="211" fill="#f2efe2" fontSize="21" fontFamily="Georgia, serif" letterSpacing="2">SLOW SUNDAY</text>
        <text x="23" y="234" fill="#b6c8b8" fontSize="9" letterSpacing="3">THE VINYL COLLECTION</text>
      </g>
      <ellipse cx="332" cy="365" rx="205" ry="38" fill="#697364" opacity=".17"/>
      <path d="m147 213 355 14 38 133-361 9Z" fill="url(#wood)"/>
      <path d="m179 369 361-9v23l-361 12Z" fill="#775338"/>
      <path d="m147 213 32 156v26l-32-155Z" fill="#986940"/>
      <path d="m166 225 317 12 33 107-323 8Z" fill="#d9d6c5"/>
      <ellipse cx="319" cy="283" rx="116" ry="64" fill="#1e2826"/>
      {[104, 95, 86, 77, 68, 59].map((r) => <ellipse key={r} cx="319" cy="283" rx={r} ry={r * .55} fill="none" stroke="#4a514b" strokeWidth=".7"/>)}
      <ellipse cx="319" cy="283" rx="35" ry="19" fill="#b76842"/>
      <ellipse cx="319" cy="283" rx="20" ry="11" fill="none" stroke="#e4bb8e" strokeWidth=".8"/>
      <ellipse cx="319" cy="283" rx="4" ry="3" fill="#e5e2d5"/>
      <ellipse cx="458" cy="253" rx="13" ry="9" fill="#5b635a"/>
      <path d="m458 252 17 39-47 37" fill="none" stroke="#777e72" strokeWidth="8" strokeLinecap="round"/>
      <path d="m458 249 17 39-47 37" fill="none" stroke="#eef0e3" strokeWidth="4" strokeLinecap="round"/>
      <path d="m420 320 18 8-15 13-18-7Z" fill="#263c36"/>
      <ellipse cx="210" cy="337" rx="9" ry="5" fill="#627163"/>
      <circle cx="481" cy="332" r="4" fill="#145c53"/>
      <path d="m447 63 32 58m-18-45 35-13m-26 28 31 9" stroke="#7b8565" strokeWidth="3" fill="none"/>
      <ellipse cx="459" cy="74" rx="19" ry="7" fill="#748064" transform="rotate(42 459 74)"/>
      <ellipse cx="491" cy="66" rx="18" ry="7" fill="#8a9477" transform="rotate(-24 491 66)"/>
      <ellipse cx="494" cy="99" rx="18" ry="7" fill="#7e896b" transform="rotate(25 494 99)"/>
      <path d="M454 121h48l-5 65c-14 8-28 8-39 0Z" fill="#bcb9a4"/>
      <ellipse cx="478" cy="121" rx="24" ry="6" fill="#9c9c87"/>
    </svg>
  );
}
