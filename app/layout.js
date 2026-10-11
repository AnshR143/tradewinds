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
      {/* Browser extensions such as Grammarly add attributes to <body> before React loads.
          This tells React not to warn about that difference. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
