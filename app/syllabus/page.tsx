import Link from 'next/link'
import { SiteHeader } from '@/components/layout/site-header'
import { FileSearch } from 'lucide-react'
export const metadata={title:'Syllabus',description:'Syllabus updates from government recruitment notifications.'}
export default function Page(){return <><SiteHeader/><main className="listing-page"><div className="listing-header"><div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>Syllabus</span></div><span className="section-kicker">RECRUITMENT UPDATES</span><h1>Exam syllabus</h1><p>Browse syllabus information when it is confirmed in an official recruitment notice.</p></div><div className="resource-list"><div className="empty-panel"><span className="empty-icon"><FileSearch/></span><h3>No syllabus updates yet</h3><p>There are no verified syllabus records to display. Check the linked official notification for confirmed details.</p><Link href="/jobs" className="outline-link">Browse latest jobs</Link></div></div></main></>}
