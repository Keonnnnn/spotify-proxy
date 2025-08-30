// api/now-playing.js
// Vercel Serverless Function (Node runtime)

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
} = process.env;

// ---- helpers ---------------------------------------------------------------

function setNoStore(res) {
  // Kill caching everywhere (browser + Vercel CDN)
  res.setHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('CDN-Cache-Control', 'no-store');
  res.setHeader('Vercel-CDN-Cache-Control', 'no-store');
}

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*'); // or your domain
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function basicAuthHeader() {
  const key = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  return `Basic ${key}`;
}

async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }
  return res.json();
}

// ---- handler ---------------------------------------------------------------

export default async function handler(req, res) {
  setCORS(res);
  setNoStore(res);

  // Preflight for CORS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { access_token } = await getAccessToken();

    const nowRes = await fetch(NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    // No content or error from Spotify means "not playing"
    if (nowRes.status === 204 || nowRes.status >= 400) {
      return res.status(200).json({ isPlaying: false });
    }

    const d = await nowRes.json();

    // Defensive fallbacks
    const item = d?.item || {};
    const artists = Array.isArray(item.artists) ? item.artists.map(a => a?.name).filter(Boolean) : [];
    const images = item?.album?.images || [];
    const artwork = images[0]?.url || '';

    return res.status(200).json({
      isPlaying: Boolean(d?.is_playing),
      title: item?.name || '',
      artist: artists.join(', '),
      album: item?.album?.name || '',
      artwork,
      url: item?.external_urls?.spotify || '',
      progressMs: Number.isFinite(d?.progress_ms) ? d.progress_ms : 0,
      durationMs: Number.isFinite(item?.duration_ms) ? item.duration_ms : 0,
    });
  } catch (err) {
    // Keep 200 with isPlaying:false if you prefer not to surface server errors to the UI:
    // return res.status(200).json({ isPlaying: false, error: String(err) });
    return res.status(500).json({ isPlaying: false, error: String(err) });
  }
}
