import { redirect } from 'next/navigation';

export default function AdminExportRedirect() {
  redirect('/admin/impostazioni?tab=export');
}
