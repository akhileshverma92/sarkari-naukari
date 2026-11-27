import { ResourceList } from '@/components/jobs/resource-list'
export const metadata={title:'Exam Calendar',description:'Upcoming examination dates published with recruitment information.'}
export default function Page(){return <ResourceList kind="calendar" title="Exam calendar" description="Keep track of examination dates announced by recruiting authorities."/>}
