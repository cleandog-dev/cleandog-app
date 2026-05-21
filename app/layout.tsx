import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';
import { InstallPWA } from '@/components/InstallPWA';

export const metadata: Metadata = {
  title: { default: 'CleanDOG — Toelettatura cani e gatti · Messina', template: '%s | CleanDOG' },
  description: 'Prenota online la toelettatura del tuo cane o gatto a Messina. Conferma immediata, promemoria automatici.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon', type: 'image/png', sizes: '512x512' }],
    apple: [{ url: '/apple-icon', type: 'image/png', sizes: '180x180' }],
    shortcut: '/icon',
  },
  openGraph: { type: 'website', locale: 'it_IT', siteName: 'CleanDOG', images: ['/logo.png'] },
  appleWebApp: { title: 'CleanDOG', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  themeColor: '#3D5A47',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                window.__cleandogBIP = null;
                window.addEventListener('beforeinstallprompt', function(e){
                  e.preventDefault();
                  window.__cleandogBIP = e;
                  window.dispatchEvent(new CustomEvent('cleandog-bip-ready'));
                });
                window.addEventListener('appinstalled', function(){
                  window.__cleandogBIP = null;
                });
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning>
        <InstallPWA />
        {children}
        <Toaster />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
