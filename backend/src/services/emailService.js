// Email transport for QuestLab review notifications.
//
// Behaviour:
//   - If RESEND_API_KEY is set AND the `resend` npm package is installed,
//     real emails go out via Resend.
//   - If either is missing, we log the email payload to stdout in the same
//     `[EMAIL TRIGGER]` format the previous mock used. Dev never breaks just
//     because someone hasn't installed the package or set an API key.
//
// Required env (for real delivery):
//   RESEND_API_KEY  — Resend API key (https://resend.com)
//   EMAIL_FROM      — From address, e.g. "QuestLab <noreply@questlab.dev>"
// Optional:
//   APP_URL         — Public URL of the frontend, used in CTA links.

const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const FROM_EMAIL = process.env.EMAIL_FROM || 'QuestLab <onboarding@resend.dev>';

// Lazily initialised Resend client. We do this in a getter so a missing
// `resend` package doesn't blow up module load — only callers that try to
// actually send hit the dynamic import.
let resendClient = null;
let resendInitTried = false;

const getResendClient = async () => {
    if (resendInitTried) return resendClient;
    resendInitTried = true;

    if (!process.env.RESEND_API_KEY) {
        return null;
    }
    try {
        const mod = await import('resend');
        const Resend = mod.Resend;
        if (!Resend) {
            console.warn('⚠ resend package loaded but Resend export missing — using mock email transport.');
            return null;
        }
        resendClient = new Resend(process.env.RESEND_API_KEY);
        return resendClient;
    } catch (err) {
        // Most likely cause: the package isn't installed. Fall back gracefully.
        console.warn('⚠ resend package not available — using mock email transport. Run `npm install resend` to enable real delivery.');
        return null;
    }
};

// Tiny HTML escape so user-supplied feedback can't smuggle markup into the
// rendered email. The plaintext copy uses the raw value.
const escapeHtml = (s) => String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const baseShell = ({ headline, body }) => `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(headline)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f7fb;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.05);">
<tr><td style="background:linear-gradient(90deg,#6366f1,#a855f7,#ec4899);padding:24px 32px;">
<span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">QuestLab</span>
</td></tr>
<tr><td style="padding:32px;">
${body}
</td></tr>
<tr><td style="background:#fafafa;padding:20px 32px;border-top:1px solid #f0f0f3;text-align:center;">
<span style="font-size:11px;color:#9ca3af;">You're receiving this because your QuestLab project was reviewed.</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

const ctaButton = (label, color1, color2) => `<a href="${APP_URL}/dashboard" style="display:inline-block;background:linear-gradient(90deg,${color1},${color2});color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:12px;">${escapeHtml(label)} →</a>`;

const feedbackBlock = (feedback, accentBg, accentBorder, labelColor, textColor) => {
    if (!feedback) return '';
    return `<div style="background:${accentBg};border:1px solid ${accentBorder};border-radius:12px;padding:16px;margin:0 0 24px;">
<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:${labelColor};text-transform:uppercase;margin-bottom:6px;">Admin note</div>
<div style="font-size:14px;line-height:1.6;color:${textColor};white-space:pre-wrap;">${escapeHtml(feedback)}</div>
</div>`;
};

const buildApprovalEmail = ({ name, taskTitle, xpReward, feedback }) => {
    const subject = `Project approved: ${taskTitle}`;
    const body = `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Hey ${escapeHtml(name)},</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">Great news — your project was approved.</p>
<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:16px;padding:20px;margin:0 0 24px;">
<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#059669;text-transform:uppercase;margin-bottom:6px;">Approved</div>
<div style="font-size:18px;font-weight:700;color:#064e3b;">${escapeHtml(taskTitle)}</div>
<div style="margin-top:10px;font-size:14px;color:#065f46;">⭐ You earned <strong>${Number(xpReward) || 0} XP</strong></div>
</div>
${feedbackBlock(feedback, '#f9fafb', '#e5e7eb', '#6b7280', '#374151')}
${ctaButton('View your dashboard', '#10b981', '#14b8a6')}
<p style="margin:24px 0 0;font-size:14px;color:#6b7280;">Keep going,<br><strong>The QuestLab team</strong></p>`;
    const text = `Hey ${name},

Your project "${taskTitle}" was approved. You earned ${xpReward} XP.${feedback ? `

Admin note:
${feedback}` : ''}

Open your dashboard: ${APP_URL}/dashboard

— The QuestLab team`;
    return { subject, html: baseShell({ headline: subject, body }), text };
};

const buildRevisionEmail = ({ name, taskTitle, feedback }) => {
    const subject = `Revision requested: ${taskTitle}`;
    const body = `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Hey ${escapeHtml(name)},</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">Your reviewer would like you to take another pass at this project.</p>
<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:20px;margin:0 0 24px;">
<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#c2410c;text-transform:uppercase;margin-bottom:6px;">Needs revision</div>
<div style="font-size:18px;font-weight:700;color:#7c2d12;">${escapeHtml(taskTitle)}</div>
<div style="margin-top:10px;font-size:14px;color:#9a3412;">Resubmit when you're ready — XP gets awarded on the approved version.</div>
</div>
${feedbackBlock(feedback, '#fff7ed', '#fed7aa', '#c2410c', '#7c2d12')}
${ctaButton('Resubmit your project', '#f97316', '#ef4444')}
<p style="margin:24px 0 0;font-size:14px;color:#6b7280;">You've got this,<br><strong>The QuestLab team</strong></p>`;
    const text = `Hey ${name},

Your reviewer requested a revision on "${taskTitle}".${feedback ? `

Admin feedback:
${feedback}` : ''}

Resubmit when you're ready: ${APP_URL}/dashboard

— The QuestLab team`;
    return { subject, html: baseShell({ headline: subject, body }), text };
};

const buildRejectionEmail = ({ name, taskTitle, feedback }) => {
    const subject = `Project rejected: ${taskTitle}`;
    const body = `<h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#111827;">Hey ${escapeHtml(name)},</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">After review, this submission wasn't approved.</p>
<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:16px;padding:20px;margin:0 0 24px;">
<div style="font-size:11px;font-weight:700;letter-spacing:0.1em;color:#b91c1c;text-transform:uppercase;margin-bottom:6px;">Rejected</div>
<div style="font-size:18px;font-weight:700;color:#7f1d1d;">${escapeHtml(taskTitle)}</div>
</div>
${feedbackBlock(feedback, '#fef2f2', '#fecaca', '#b91c1c', '#7f1d1d')}
<p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#4b5563;">Reach out to your instructor if you'd like to discuss next steps.</p>
${ctaButton('Open your dashboard', '#6366f1', '#a855f7')}
<p style="margin:24px 0 0;font-size:14px;color:#6b7280;">— The QuestLab team</p>`;
    const text = `Hey ${name},

Your submission for "${taskTitle}" was rejected.${feedback ? `

Admin notes:
${feedback}` : ''}

Open your dashboard: ${APP_URL}/dashboard

— The QuestLab team`;
    return { subject, html: baseShell({ headline: subject, body }), text };
};

const buildEmail = (type, payload) => {
    if (type === 'approved' || type === 'approval') return buildApprovalEmail(payload);
    if (type === 'revision') return buildRevisionEmail(payload);
    return buildRejectionEmail(payload);
};

/**
 * Send a review-status email to a learner. Always resolves — never throws —
 * because email delivery must not block or roll back the underlying review
 * action.
 *
 * @param {Object} params
 * @param {string} params.to            recipient email
 * @param {string} params.name          learner's display name
 * @param {string} params.type          'approved' | 'revision' | 'rejected'
 * @param {string} params.taskTitle     project title
 * @param {number} [params.xpReward]    XP credited (approval only)
 * @param {string} [params.feedback]    admin feedback body
 * @returns {Promise<{ sent?: true, mocked?: true, id?: string, error?: string }>}
 */
export const sendReviewEmail = async ({ to, name, type, taskTitle, xpReward = 0, feedback = '' }) => {
    if (!to) {
        return { error: 'no recipient' };
    }

    const { subject, html, text } = buildEmail(type, {
        name: name || 'there',
        taskTitle: taskTitle || 'your project',
        xpReward,
        feedback
    });

    const client = await getResendClient();
    if (!client) {
        // Mock path — keep the original [EMAIL TRIGGER] shape so existing log
        // scrapers / tests keep working.
        console.log(`[EMAIL TRIGGER] To: ${to} - Subject: ${subject} - ${text.split('\n')[0]}`);
        return { mocked: true };
    }

    try {
        const result = await client.emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html,
            text
        });
        if (result?.error) {
            console.error('⚠ Resend send returned an error:', result.error);
            return { error: result.error.message || 'send failed' };
        }
        return { sent: true, id: result?.data?.id };
    } catch (err) {
        console.error('⚠ Resend send threw:', err);
        return { error: err.message || 'send failed' };
    }
};

export const isEmailConfigured = () => !!process.env.RESEND_API_KEY;
