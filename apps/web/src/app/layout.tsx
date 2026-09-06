import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Navbar } from '@/components/Navbar';
import { BottomNav } from '@/components/BottomNav';
import { SearchFilterProvider } from '@/context/SearchFilterContext';
import { ActiveIssueProvider } from '@/context/ActiveIssueContext';
import { ToastProvider } from '@/context/ToastContext';

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
    <html lang="en" className="h-full">
      <body className="bg-[#F8F9FA] text-[#1F1F1F] h-full h-[100dvh] max-h-[100dvh] flex flex-col overflow-hidden antialiased selection:bg-[#D3E3FD] selection:text-[#041E49]">
        <ActiveIssueProvider>
          <SearchFilterProvider>
            <ToastProvider>
              <Navbar />
              <main className="flex-1 min-h-0 flex flex-col overflow-hidden relative">{children}</main>
              <Suspense fallback={null}>
                <BottomNav />
              </Suspense>
            </ToastProvider>
          </SearchFilterProvider>
        </ActiveIssueProvider>
      </body>
    </html>
  );
}
