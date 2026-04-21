// ═══════════════════════════════════════════════════════════
//  CALO COMMAND CENTER — Vercel Serverless Proxy
//  /api/gas.js
//
//  Architecture:
//    Browser → POST /api/gas → (server-side) → GAS Web App
//                                            → Google Sheets
//
//  Why a proxy?
//    • Google Apps Script blocks cross-origin requests from
//      browsers (CORS). Calling GAS server-side from Vercel
//      has no CORS restrictions at all.
//    • Your GAS_URL stays in an env variable — never exposed
//      to the client.
// ═══════════════════════════════════════════════════════════

export default async function handler(req, res) {

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const GAS_URL = process.env.GAS_URL;

  if (!GAS_URL) {
    console.error('GAS_URL environment variable is not set');
    return res.status(500).json({ error: 'Server misconfiguration: GAS_URL not set' });
  }

  try {
    // Forward the request body straight to GAS
    const gasResponse = await fetch(GAS_URL, {
      method:   'POST',
      headers:  { 'Content-Type': 'application/json' },
      body:     JSON.stringify(req.body),
      redirect: 'follow',   // GAS redirects from /exec → /exec (with token)
    });

    if (!gasResponse.ok) {
      const text = await gasResponse.text();
      console.error('GAS error:', gasResponse.status, text);
      return res.status(502).json({ error: 'GAS upstream error', status: gasResponse.status });
    }

    const data = await gasResponse.json();

    // Pass the GAS response back to the browser
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);

  } catch (err) {
    console.error('Proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
