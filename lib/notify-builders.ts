import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
import { APP_TIMEZONE, animalLabel, formatEUR } from '@/lib/utils';
import type { PushPayload } from '@/lib/push';

type BookingLike = {
  id: string;
  startsAt: Date;
  customerName: string;
  customerPhone: string;
  dogName: string;
  dogBreed: string | null;
  priceCents: number;
};

function fmtWhen(d: Date): string {
  const z = toZonedTime(d, APP_TIMEZONE);
  return format(z, 'EEE dd/MM/yyyy HH:mm', { locale: it });
}

function fmtTime(d: Date): string {
  const z = toZonedTime(d, APP_TIMEZONE);
  return format(z, 'HH:mm');
}

function cleanServiceName(name: string): string {
  return name.replace(/ — (Cane|Gatto)$/, '');
}

export function buildBookingCreatedAdminPayload(b: BookingLike, serviceName: string): PushPayload {
  const animal = animalLabel(b);
  const breed = b.dogBreed ? ` (${b.dogBreed})` : '';
  return {
    title: '🐕 Nuova prenotazione',
    body: `${animal}${breed} · ${cleanServiceName(serviceName)} · ${fmtWhen(b.startsAt)} · ${formatEUR(b.priceCents)} · ${b.customerName}`,
    url: '/admin/dashboard',
    tag: `booking-${b.id}`,
    requireInteraction: true,
  };
}

export function buildBookingConfirmedClientPayload(b: BookingLike, serviceName: string): PushPayload {
  return {
    title: '✅ Prenotazione confermata',
    body: `${cleanServiceName(serviceName)} · ${fmtWhen(b.startsAt)} · ${formatEUR(b.priceCents)}`,
    url: '/',
    tag: `client-confirm-${b.id}`,
  };
}

export function buildBookingCancelledAdminPayload(b: BookingLike, serviceName: string): PushPayload {
  const animal = animalLabel(b);
  return {
    title: '❌ Prenotazione cancellata',
    body: `${animal} · ${cleanServiceName(serviceName)} · ${fmtWhen(b.startsAt)} · ${b.customerName}`,
    url: '/admin/dashboard',
    tag: `booking-cancel-${b.id}`,
    requireInteraction: true,
  };
}

export function buildReminderAdminPayload(b: BookingLike, serviceName: string): PushPayload {
  const animal = animalLabel(b);
  return {
    title: '⏰ Tra 1h appuntamento',
    body: `${animal} · ${cleanServiceName(serviceName)} · ${fmtWhen(b.startsAt)} · ${b.customerName}`,
    url: '/admin/staff',
    tag: `reminder-${b.id}`,
  };
}

export function buildReminderClientPayload(b: BookingLike, serviceName: string): PushPayload {
  const animal = animalLabel(b);
  return {
    title: '⏰ Promemoria appuntamento',
    body: `Tra 1h: ${animal} — ${cleanServiceName(serviceName)} alle ${fmtTime(b.startsAt)}`,
    url: '/',
    tag: `client-reminder-${b.id}`,
  };
}
