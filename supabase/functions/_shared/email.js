// Resend transport for the two emails an inquiry generates.
//
// The inquiry row is already committed before this runs. Nothing in here may
// throw its way back to the couple: an email problem is the studio's problem,
// not a reason to tell someone their inquiry failed.

export const RESEND_URL = 'https://api.resend.com/emails';

const SEND_TIMEOUT_MS = 8000;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function row(label, value) {
  if (!value) return '';
  return `<tr><td style="padding:4px 12px 4px 0;font-weight:bold">${escapeHtml(label)}</td>` +
    `<td style="padding:4px 0">${escapeHtml(value)}</td></tr>`;
}

function studioHtml(inquiry) {
  return `<h2>New booking inquiry</h2><table>${
    row('Name', inquiry.name)
  }${row('Email', inquiry.email)
  }${row('Phone', inquiry.phone)
  }${row('Wedding date', inquiry.weddingDate)
  }${row('Venue', inquiry.venue)
  }${row('Services', (inquiry.services ?? []).join(', '))
  }</table><h3>Message</h3><p>${escapeHtml(inquiry.message || '(none)')}</p>` +
    `<p style="color:#666;font-size:12px">Inquiry ${escapeHtml(inquiry.id)}</p>`;
}

function coupleHtml(inquiry) {
  return `<p>Dear ${escapeHtml(inquiry.name)},</p>` +
    '<p>Thank you for your inquiry. We have it, and someone from the studio will reply ' +
    'personally within two working days.</p>' +
    `<p>For reference, you told us your wedding is on ${escapeHtml(inquiry.weddingDate)} ` +
    `at ${escapeHtml(inquiry.venue)}. If anything there is wrong, simply reply to this email.</p>` +
    '<p>— Peak Story Studio</p>';
}

async function send(payload, { apiKey, fetchImpl }) {
  const response = await fetchImpl(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend responded ${response.status}: ${detail}`);
  }

  return response.json();
}

export async function sendInquiryEmails(
  inquiry,
  { apiKey, fromAddress, studioEmail, fetchImpl = fetch } = {},
) {
  if (!apiKey || !fromAddress || !studioEmail) {
    console.warn('submit-inquiry: email not configured, skipping send');
    return { status: 'skipped' };
  }

  // Both sends go out together rather than one after the other. The couple is
  // watching a disabled button while this runs, and sequential sends stack
  // their timeouts: a degraded-but-not-dead Resend could hold them for the
  // full SEND_TIMEOUT_MS twice over before they see anything. Concurrently the
  // worst case is one timeout, not two.
  //
  // It also means a bad STUDIO_NOTIFY_EMAIL no longer costs the couple their
  // acknowledgement. Sequentially the studio send failing returned early and
  // the couple heard nothing; now they are still thanked, and the row still
  // records that the studio was never told.
  const [studioResult, coupleResult] = await Promise.allSettled([
    send({
      from: fromAddress,
      to: [studioEmail],
      reply_to: inquiry.email,
      subject: `New inquiry — ${inquiry.name}, ${inquiry.weddingDate}`,
      html: studioHtml(inquiry),
    }, { apiKey, fetchImpl }),
    send({
      from: fromAddress,
      to: [inquiry.email],
      reply_to: studioEmail,
      subject: 'We have your wedding inquiry',
      html: coupleHtml(inquiry),
    }, { apiKey, fetchImpl }),
  ]);

  if (coupleResult.status === 'rejected') {
    // Worth logging, not worth marking the inquiry un-notified: whether the
    // couple got their thank-you says nothing about whether the studio has
    // the lead, and notification_status is about the latter.
    console.error(
      'submit-inquiry: couple acknowledgement failed',
      coupleResult.reason?.message,
    );
  }

  if (studioResult.status === 'rejected') {
    console.error(
      'submit-inquiry: studio notification failed',
      studioResult.reason?.message,
    );
    return { status: 'failed' };
  }

  return { status: 'sent' };
}
