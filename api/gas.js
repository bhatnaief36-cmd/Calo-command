// ═══════════════════════════════════════════════════════════
//  CALO COMMAND CENTER — Vercel Serverless Proxy
//  /api/gas.js  (CommonJS — no ESM warning)
// ═══════════════════════════════════════════════════════════

module.exports = async function handler(req, res) {

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const GAS_URL = process.env.GAS_URL;

  if (!GAS_URL) {
    return res.status(500).json({ error: 'GAS_URL env variable not set' });
  }

  try {
    const gasResponse = await fetch(GAS_URL, {
      method:   'POST',
      headers:  { 'Content-Type': 'application/json' },
      body:     JSON.stringify(req.body),
      redirect: 'follow',
    });

    if (!gasResponse.ok) {
      const text = await gasResponse.text();
      return res.status(502).json({ error: 'GAS error', status: gasResponse.status, detail: text });
    }

    const data = await gasResponse.json();
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
