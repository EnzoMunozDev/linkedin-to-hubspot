export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, redirectUri } = req.body;
  if (!code || !redirectUri) {
    return res.status(400).json({ error: "Missing params" });
  }

  try {
    const tokenRes = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: process.env.HUBSPOT_CLIENT_ID,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code
      })
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("HubSpot error:", errText);
      return res.status(400).json({ error: "Token exchange failed", details: errText });
    }

    const tokenData = await tokenRes.json();
    const infoRes = await fetch("https://api.hubapi.com/oauth/v1/access-tokens/" + tokenData.access_token);
    const infoData = infoRes.ok ? await infoRes.json() : {};

    return res.status(200).json({
      access_token: tokenData.access_token,
      expires_in: tokenData.expires_in,
      hub_id: infoData.hub_id || null
    });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ error: "Server error", message: err.message });
  }
}
