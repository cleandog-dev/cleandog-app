import { redirect } from 'next/navigation';

export default function AdminExtrasRedirect() {
  redirect('/admin/catalogo?tab=extra');
}
