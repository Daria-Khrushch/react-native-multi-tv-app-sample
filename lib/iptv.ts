export type ChannelRow = { id: string; name: string };
export type StreamRow = {
  channel: string | null;
  feed?: string | null;
  title?: string;
  url: string;
  referrer?: string | null;
  user_agent?: string | null;
  quality?: string | null;
};
export type LogoRow = {
  channel: string;
  feed?: string | null;
  format?: 'PNG' | 'JPEG' | 'SVG' | 'GIF' | 'WebP' | 'AVIF' | 'APNG' | null;
  url: string;
  tags?: string[];
};

// ---- API endpoints ----
const URLS = {
  channels: 'https://iptv-org.github.io/api/channels.json',
  streams: 'https://iptv-org.github.io/api/streams.json',
  logos: 'https://iptv-org.github.io/api/logos.json',
  block: 'https://iptv-org.github.io/api/blocklist.json',
};

// Small helper to fetch & parse JSON with typing
async function j<T>(u: string) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return (await r.json()) as T;
}

// RN <Image> can't render SVG without extra libs; prefer raster formats
const RASTER = new Set(['PNG', 'JPEG', 'WebP', 'GIF', 'APNG']);

function isValidUrl(u?: string | null): u is string {
  const t = (u ?? '').trim();
  if (!t) return false;
  return /^https?:\/\//i.test(t);
}

// Pick the first valid stream
function pickBestStream(rows: StreamRow[]): StreamRow | null {
  if (!rows.length) return null;
  return rows.find((s) => isValidUrl(s.url)) ?? null;
}

// Pick a logo, preferring: (1) exact feed match in raster format,
// then (2) tagged "horizontal"/"white" raster, then (3) any raster.
function pickBestLogo(rows: LogoRow[], feed?: string | null): string | undefined {
  const byFeed = rows.find((l) => l.feed && feed && l.feed === feed && (l.format ? RASTER.has(l.format) : true));
  if (byFeed) return byFeed.url;
  const pref = rows.find(
    (l) => (l.tags?.includes('horizontal') || l.tags?.includes('white')) && (l.format ? RASTER.has(l.format) : true),
  );
  if (pref) return pref.url;
  const raster = rows.find((l) => (l.format ? RASTER.has(l.format) : true));
  return raster?.url;
}

// ---- UI-friendly shape used by the app ----
export type UiChannel = {
  id: string;
  name: string;
  url: string;
  logo?: string;
  referrer?: string | null;
  userAgent?: string | null;
  streamTitle?: string | null;
};

// Load, merge and reduce the raw API data into UiChannel[] (limited)
export async function loadUiChannels(limit = 30): Promise<UiChannel[]> {
  const [channels, streams, logos, block] = await Promise.all([
    j<ChannelRow[]>(URLS.channels),
    j<StreamRow[]>(URLS.streams),
    j<LogoRow[]>(URLS.logos),
    j<{ channel: string }[]>(URLS.block),
  ]);

  // Build quick lookup structures
  const blocked = new Set(block.map((b) => b.channel)); // DMCA/NSFW blocked channels
  const nameById = new Map(channels.map((c) => [c.id, c.name])); // channel id -> name

  const logosByChannel = new Map<string, LogoRow[]>();
  logos.forEach((l) => {
    if (!logosByChannel.has(l.channel)) logosByChannel.set(l.channel, []);
    logosByChannel.get(l.channel)!.push(l);
  });

  // Group streams by channel, skipping blocked or invalid ones
  const byChannel = new Map<string, StreamRow[]>();
  streams.forEach((s) => {
    if (!s.channel || !s.url) return;
    if (blocked.has(s.channel)) return;
    if (!isValidUrl(s.url)) return;
    if (!byChannel.has(s.channel)) byChannel.set(s.channel, []);
    byChannel.get(s.channel)!.push(s);
  });

  // Reduce to UiChannel[], one entry per channel, up to "limit"
  const result: UiChannel[] = [];
  for (const [channelId, rows] of byChannel) {
    const best = pickBestStream(rows);
    if (!best) continue;
    const logoUrl = pickBestLogo(logosByChannel.get(channelId) ?? [], best.feed);
    result.push({
      id: channelId,
      name: nameById.get(channelId) ?? channelId,
      url: best.url,
      logo: logoUrl,
      referrer: best.referrer ?? null,
      userAgent: best.user_agent ?? null,
      streamTitle: best.title ?? null,
    });
    if (result.length >= limit) break;
  }
  return result;
}
