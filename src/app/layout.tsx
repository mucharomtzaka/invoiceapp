import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'Kwitansi — Kelola transaksi lebih mudah',description:'Aplikasi kwitansi, bukti pembayaran, dan struk transaksi'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="id"><body>{children}</body></html>}
