import { DM_Sans, Inter } from 'next/font/google';
import './globals.css';

const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const heading = DM_Sans({ subsets: ['latin'], variable: '--font-heading', display: 'swap' });

export const metadata = {
  title: 'TradeWinds',
  description: 'Say what you noticed. See who it helps, who it hurts, and why.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${body.variable} ${heading.variable}`}>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
