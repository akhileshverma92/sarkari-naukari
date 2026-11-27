import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { FileSearch } from 'lucide-react'
export const metadata={title:'Answer Keys',description:'Official government examination answer key updates.'}
export default function Page(){return <><SiteHeader/><main className="listing-page"><div className="listing-header"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>Answer keys</span></div><span className="section-kicker">RECRUITMENT UPDATES</span><h1>Answer keys</h1><p>Official answer key notices will appear here when they are available.</p></div><div className="resource-list"><div className="empty-panel"><span className="empty-icon"><FileSearch/></span><h3>No answer key updates yet</h3><p>We only publish verified information. Check back when recruiting authorities release answer keys.</p><Link href="/jobs" className="outline-link">Browse latest jobs</Link></div></div></main></>}
