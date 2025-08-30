// api/now-playing.js
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const NOW_PLAYING_URL = 'https://api.spotify.com/v1/me/player/currently-playing';

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN
} = process.env;

function basicAuth() {
  const key = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  return `Basic ${key}`;
}

async function getAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: SPOTIFY_REFRESH_TOKEN
    })
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  return res.json();
}

export default async function handler(req, res) {
  try {
    const { access_token } = await getAccessToken();

    const nowRes = await fetch(NOW_PLAYING_URL, {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    if (nowRes.status === 204 || nowRes.status > 400) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).json({ isPlaying: false });
    }

    const d = await nowRes.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({
      isPlaying: d.is_playing,
      title: d.item?.name,
      artist: d.item?.artists?.map(a => a.name).join(', '),
      album: d.item?.album?.name,
      artwork: d.item?.album?.images?.[0]?.url,
      url: d.item?.external_urls?.spotify
    });
  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ isPlaying: false, error: String(err) });
  }
}
