import { ResourceList } from '@/components/jobs/resource-list'
export const metadata={title:'Recruitment Results',description:'Officially published results for government recruitment examinations.'}
export default function Page(){return <ResourceList kind="result" title="Results" description="See published result updates linked to government recruitment notices."/>}
