import '../styles/globals.css'
import { Toaster } from 'sonner';

export const metadata = {
  title: 'NFC Discount System',
  description: 'Manage customers, cards, and discounts.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-gray-100 min-h-screen">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
