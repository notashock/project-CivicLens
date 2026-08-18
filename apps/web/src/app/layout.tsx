import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'CivicTrace — Anonymous, Community-Verified Civic Accountability',
  description:
    'Report anonymously. Verify locally. Speak collectively. Track publicly. India DIGIPIN standard civic platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#FBF9F5] text-zinc-900 min-h-screen flex flex-col antialiased selection:bg-[#FEF3C7] selection:text-amber-950">
        <Navbar />
        <main className="flex-1 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
