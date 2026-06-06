import { redirect } from 'next/navigation';

export default function AdminHoursRedirect() {
  redirect('/admin/impostazioni?tab=orari');
}
