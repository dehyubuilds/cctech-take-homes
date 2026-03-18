/**
 * Receipt + license email HTML for Dropflow. Replaces {{key}} placeholders.
 */
export function renderReceiptLicense(params: {
  orderId: string;
  date: string;
  buyerEmail: string;
  songTitle: string;
  creatorName: string;
  amountPaid: string;
  downloadExpiresAt: string;
  downloadUrl: string;
}): string {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Receipt & License</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 24px; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1rem; margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .meta { color: #666; font-size: 0.875rem; margin-bottom: 1.5rem; }
    .section { margin: 1rem 0; padding: 1rem; background: #f5f5f5; border-radius: 8px; }
    .cta { display: inline-block; margin-top: 1rem; padding: 12px 20px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; }
    ul { margin: 0.5rem 0; padding-left: 1.25rem; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 1.5rem 0; }
  </style>
</head>
<body>
  <h1>Receipt & License</h1>
  <div class="meta">
    Order ID: {{orderId}}<br />
    Date: {{date}}<br />
    Buyer: {{buyerEmail}}
  </div>

  <div class="section">
    <strong>Purchase</strong><br />
    Track: {{songTitle}}<br />
    Creator: {{creatorName}}<br />
    Amount paid: {{amountPaid}}
  </div>

  <h2>License</h2>
  <p><strong>Ownership:</strong> Creator retains full ownership of the work.</p>
  <p><strong>License:</strong> Buyer receives a non-exclusive license to use the work (song or beat).</p>
  <p><strong>Restrictions:</strong></p>
  <ul>
    <li>You may not resell the work as a standalone product.</li>
    <li>You may not claim ownership of the composition or master.</li>
  </ul>

  <h2>Delivery</h2>
  <p>Download your purchase (link expires {{downloadExpiresAt}}):</p>
  <a href="{{downloadUrl}}" class="cta">Download</a>

  <hr />
  <p style="font-size: 0.75rem; color: #888;">Dropflow – Statics.</p>
</body>
</html>`;
  let out = html;
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp(`{{${k}}}`, "g"), String(v));
  }
  return out;
}
