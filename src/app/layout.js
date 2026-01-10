import '../styles/globals.css'
import { Toaster } from 'sonner';
import { LanguageProvider } from '@/lib/LanguageContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { SettingsProvider } from '@/lib/SettingsContext';
import { Tajawal } from 'next/font/google';

const tajawal = Tajawal({
  subsets: ['arabic'],
  weight: ['200', '300', '400', '500', '700', '800', '900'],
  display: 'swap',
});

export const metadata = {
  title: 'NFC Discount System',
  description: 'Manage customers, cards, and discounts.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${tajawal.className} bg-white dark:bg-slate-950 min-h-screen transition-colors duration-300`} suppressHydrationWarning>
        <LanguageProvider>
          <ThemeProvider>
            <SettingsProvider>
              {children}
            </SettingsProvider>
          </ThemeProvider>
          <Toaster position="top-right" richColors />
        </LanguageProvider>
      </body>
    </html>
  )
}
