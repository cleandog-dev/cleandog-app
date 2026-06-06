import { redirect } from 'next/navigation';

export default function AdminServicesRedirect() {
  redirect('/admin/catalogo?tab=servizi');
}
