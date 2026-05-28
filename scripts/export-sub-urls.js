#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const input = process.argv[2] || 'output/subscriptions.md';
const output = process.argv[3] || 'output/collector-sub-urls.txt';
const maxUrls = parseInt(process.env.EXPORT_MAX_URLS || '500', 10);

if (!fs.existsSync(input)) {
  console.error(`Input file not found: ${input}`);
  process.exit(1);
}

const content = fs.readFileSync(input, 'utf8');
const matches = content.match(/https?:\/\/[^\s<>"'`）)\]}]+/g) || [];

function cleanUrl(url) {
  return url
    .trim()
    .replace(/[.,;，。；]+$/g, '')
    .replace(/\\+/g, '');
}

function isLikelySubscriptionUrl(raw) {
  let url;
  try {
    url = new URL(cleanUrl(raw));
  } catch {
    return false;
  }

  const host = url.hostname.toLowerCase();
  const pathname = decodeURIComponent(url.pathname).toLowerCase();
  const full = decodeURIComponent(url.toString()).toLowerCase();

  const blockedHosts = [
    'api.qrserver.com',
    'img.shields.io',
    'camo.githubusercontent.com',
    'youtube.com',
    'www.youtube.com',
    'youtu.be',
    't.me',
    'telegram.me',
  ];
  if (blockedHosts.some((blocked) => host === blocked || host.endsWith(`.${blocked}`))) return false;

  const blockedExt = /\.(png|jpg|jpeg|gif|svg|webp|ico|bmp|mp4|webm|mov|avi|zip|7z|rar|gz|tar|exe|dmg|apk|pdf)(\?|#|$)/i;
  if (blockedExt.test(pathname)) return false;

  if (full.includes('qr-code') || full.includes('qrcode')) return false;

  const positive = [
    'raw.githubusercontent.com',
    'gist.githubusercontent.com',
    'cdn.jsdelivr.net',
    '.yaml',
    '.yml',
    '.txt',
    '.conf',
    '.json',
    '/sub',
    'subscribe',
    'subscription',
    'clash',
    'mihomo',
    'v2ray',
    'vmess',
    'vless',
    'trojan',
    'ss://',
  ];

  return positive.some((needle) => full.includes(needle));
}

const urls = [];
const seen = new Set();
for (const match of matches) {
  const url = cleanUrl(match);
  if (!isLikelySubscriptionUrl(url)) continue;
  if (seen.has(url)) continue;
  seen.add(url);
  urls.push(url);
  if (urls.length >= maxUrls) break;
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${urls.join('\n')}\n`, 'utf8');
console.log(`Exported ${urls.length} subscription URLs to ${output}`);
