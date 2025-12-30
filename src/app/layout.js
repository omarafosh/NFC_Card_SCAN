import '../styles/globals.css'
import { Toaster } from 'sonner';
import { LanguageProvider } from '@/lib/LanguageContext';

export const metadata = {
  title: 'NFC Discount System',
  description: 'Manage customers, cards, and discounts.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-100 min-h-screen font-sans" suppressHydrationWarning>
        <LanguageProvider>
          {children}
          <Toaster position="top-right" richColors />
        </LanguageProvider>
      </body>
    </html>
  )
}
