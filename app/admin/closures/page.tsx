import { redirect } from 'next/navigation';

export default function AdminClosuresRedirect() {
  redirect('/admin/impostazioni?tab=orari');
}
