// Génère public/og.png (1200×630), l'image affichée quand on partage le site
// sur LinkedIn, Slack, X… Usage : node scripts/og-image.mjs
import sharp from 'sharp';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b3a57"/>
      <stop offset="1" stop-color="#0b5c8c"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <g transform="translate(860 110)">
    <rect x="105" y="0" width="50" height="34" rx="8" fill="#ffffff"/>
    <circle cx="130" cy="180" r="150" fill="#f3efe6" stroke="#ffffff" stroke-width="22"/>
    <path d="M130 275s-70-44-70-92c0-26 20-43 41-43 13 0 24 7 29 17 5-10 16-17 29-17 21 0 41 17 41 43 0 48-70 92-70 92z" fill="#e8578f"/>
    <path d="M70 175h120M85 210h90M100 240h60" stroke="#ffffff" stroke-width="5" stroke-dasharray="12 9" opacity=".8"/>
    <rect x="-40" y="335" width="270" height="56" rx="12" fill="#0f1720"/>
    <text x="-20" y="371" font-family="Consolas, monospace" font-size="22" fill="#7fd1ff">PES · DST · JEF · EXP</text>
  </g>
  <text x="80" y="200" font-family="Segoe UI, Arial, sans-serif" font-size="84" font-weight="700" fill="#ffffff">Broderie Tools</text>
  <text x="80" y="275" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#d5e7f3">Ouvrir et convertir</text>
  <text x="80" y="325" font-family="Segoe UI, Arial, sans-serif" font-size="38" fill="#d5e7f3">vos fichiers de broderie</text>
  <g font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="600">
    <rect x="80" y="400" width="300" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="104" y="435" fill="#ffffff">100 % navigateur</text>
    <rect x="400" y="400" width="200" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="424" y="435" fill="#ffffff">Gratuit</text>
    <rect x="620" y="400" width="200" height="52" rx="26" fill="#ffffff" fill-opacity="0.14"/>
    <text x="644" y="435" fill="#ffffff">Open source</text>
  </g>
  <text x="80" y="560" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#9fc3da">Brother · Janome · Tajima · Melco · Bernina</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og.png');
console.log('public/og.png généré');
