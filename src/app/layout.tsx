import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './chat-reference.css';
import './in-person.css';
const vazir=localFont({src:[{path:'../components/fonts/vazirmatn-arabic-400-normal.woff2',weight:'400'},{path:'../components/fonts/vazirmatn-arabic-700-normal.woff2',weight:'700'}],variable:'--font-vazir',display:'swap'});
export const metadata:Metadata={title:'ترب‌چت — دستیار خرید حضوری',icons:{icon:'/brand/torob-radish.png'},description:'همراه خرید حضوری تهران؛ انتخاب کالا، استعلام پیش از حرکت و برنامه‌ریزی مسیر مراجعه'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl" data-scroll-behavior="smooth"><body className={vazir.variable}><a className="skip-link" href="#main">رفتن به محتوای اصلی</a>{children}</body></html>;}
