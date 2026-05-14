import { Resend } from 'resend';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE, formatEUR } from '@/lib/utils';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? 'Cleandog <noreply@cleandog.local>';

const client = apiKey ? new Resend(apiKey) : null;

interface BookingEmailParams {
  to: string;
  customerName: string;
  dogName: string;
  serviceName: string;
  startsAt: Date;
  priceCents: number;
}

export async function sendBookingConfirmation(params: BookingEmailParams): Promise<void> {
  if (!client) {
    console.warn('RESEND_API_KEY missing — skipping confirmation email to', params.to);
    return;
  }

  const localStart = toZonedTime(params.startsAt, APP_TIMEZONE);
  const dateStr = format(localStart, "EEEE d MMMM yyyy 'alle' HH:mm", { locale: it });

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
      <h1 style="font-size: 22px; margin-bottom: 8px; color: #4a634a;">Prenotazione confermata 🐾</h1>
      <p>Ciao ${escapeHtml(params.customerName)},</p>
      <p>L'appuntamento per <strong>${escapeHtml(params.dogName)}</strong> è confermato.</p>
      <div style="background: #f4f7f4; border-radius: 12px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Servizio:</strong> ${escapeHtml(params.serviceName)}</p>
        <p style="margin: 4px 0;"><strong>Quando:</strong> ${dateStr}</p>
        <p style="margin: 4px 0;"><strong>Prezzo:</strong> ${formatEUR(params.priceCents)}</p>
      </div>
      <p>Se devi disdire o spostare l'appuntamento contattaci almeno 24 ore prima.</p>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">CleanDOG — Servizi di lavaggio e toelettatura cani e gatti</p>
    </div>
  `;

  await client.emails.send({
    from,
    to: params.to,
    subject: `Prenotazione confermata — ${dateStr}`,
    html,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
