import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Pantry & Table — Your kitchen, connected',
  description: 'Pantry, recipes, meal plans, shopping lists, and cooking history. Together in one kitchen.',
  manifest: '/manifest.webmanifest', icons: {icon:'/icon.svg'},
};
export default function Layout({children}:{children:React.ReactNode}) {
  return <html lang="en"><head><link rel="stylesheet" href="/style.css"/><link rel="stylesheet" href="/calendar.css"/><link rel="stylesheet" href="/sync.css"/><link rel="stylesheet" href="/login.css"/></head><body>{children}</body></html>;
}
