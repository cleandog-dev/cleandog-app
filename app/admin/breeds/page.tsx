import { redirect } from 'next/navigation';

export default function AdminBreedsRedirect() {
  redirect('/admin/catalogo?tab=razze');
}
