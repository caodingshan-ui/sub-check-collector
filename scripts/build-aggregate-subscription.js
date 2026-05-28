#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const input = process.argv[2] || 'output/source-sub-urls.txt';
const output = process.argv[3] || 'output/collector-sub-urls.txt';
const maxSources = parseInt(process.env.AGGREGATE_MAX_SOURCES || '120', 10);
const timeoutMs = parseInt(process.env.AGGREGATE_FETCH_TIMEOUT || '12000', 10);
const concurrency = parseInt(process.env.AGGREGATE_CONCURRENCY || '12', 10);
const maxProxies = parseInt(process.env.AGGREGATE_MAX_PROXIES || '3000', 10);

const URI_RE = /^(ss|ssr|vmess|vless|trojan|tuic|hysteria|hysteria2|hy2):\/\//i;

function maybeBase64Decode(text) {
  const compact = text.trim().replace(/\s+/g, '');
  if (!compact || compact.length < 16 || compact.length % 4 === 1) return null;
  if (!/^[A-Za-z0-9+/=_-]+$/.test(compact)) return null;
  try {
    const b64 = compact.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = Buffer.from(b64, 'base64').toString('utf8');
    if (/\u0000/.test(decoded)) return null;
    if (URI_RE.test(decoded.trim()) || decoded.includes('\n') || decoded.includes('proxies:')) return decoded;
  } catch {}
  return null;
}

function normalizeName(s) {
  return String(s || 'node').replace(/[\r\n\t]/g, ' ').trim().slice(0, 120) || 'node';
}

function extractUriLines(text) {
  const decoded = maybeBase64Decode(text) || text;
  const lines = decoded.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  return lines.filter(l => URI_RE.test(l));
}

function extractClashProxies(text) {
  const docs = [];
  const decoded = maybeBase64Decode(text) || text;
  for (const candidate of [decoded]) {
    try {
      const doc = yaml.load(candidate);
      if (doc && Array.isArray(doc.proxies)) docs.push(...doc.proxies);
      if (doc && Array.isArray(doc.Proxy)) docs.push(...doc.Proxy);
    } catch {}
  }
  return docs.filter(p => p && typeof p === 'object' && p.type && p.server && p.port);
}

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'clash.meta (https://github.com/caodingshan-ui/sub-check-collector)',
        'accept': '*/*',
      },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit(items, limit, fn) {
  const results = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx], idx).catch(err => ({ error: err.message }));
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

(async () => {
  if (!fs.existsSync(input)) {
    console.error(`Input URL list not found: ${input}`);
    process.exit(1);
  }

  const urls = fs.readFileSync(input, 'utf8')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => /^https?:\/\//i.test(l))
    .slice(0, maxSources);

  const proxyMap = new Map();
  const uriSet = new Set();
  let ok = 0;
  let failed = 0;

  await mapLimit(urls, concurrency, async (url, idx) => {
    try {
      const text = await fetchText(url);
      ok++;
      for (const line of extractUriLines(text)) {
        uriSet.add(line);
      }
      for (const proxy of extractClashProxies(text)) {
        const copy = { ...proxy };
        copy.name = normalizeName(copy.name || `${copy.type}-${copy.server}-${copy.port}`);
        let name = copy.name;
        let n = 2;
        while (proxyMap.has(name)) name = `${copy.name} ${n++}`;
        copy.name = name;
        proxyMap.set(name, copy);
        if (proxyMap.size >= maxProxies) break;
      }
      console.log(`[${idx + 1}/${urls.length}] ok ${url}`);
    } catch (e) {
      failed++;
      console.log(`[${idx + 1}/${urls.length}] fail ${url} ${e.message}`);
    }
  });

  const proxies = Array.from(proxyMap.values()).slice(0, maxProxies);
  const uriLines = Array.from(uriSet);

  let out;
  if (proxies.length > 0) {
    const names = proxies.map(p => p.name);
    out = yaml.dump({
      proxies,
      'proxy-groups': [
        { name: 'PROXY', type: 'select', proxies: names.slice(0, 500) },
        { name: 'AUTO', type: 'url-test', proxies: names.slice(0, 500), url: 'http://www.gstatic.com/generate_204', interval: 300 },
      ],
      rules: ['MATCH,PROXY'],
    }, { lineWidth: -1, noRefs: true });
  } else {
    out = Buffer.from(uriLines.join('\n') + '\n', 'utf8').toString('base64');
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, out, 'utf8');
  fs.writeFileSync(output.replace(/(\.[^.]+)?$/, '.stats.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    sources: urls.length,
    fetched: ok,
    failed,
    clashProxies: proxies.length,
    uriLines: uriLines.length,
    output,
  }, null, 2));
  console.log(`Generated ${output}: sources=${urls.length}, fetched=${ok}, failed=${failed}, clashProxies=${proxies.length}, uriLines=${uriLines.length}`);
})();
