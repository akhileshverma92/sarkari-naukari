import { TaxonomyList } from '@/components/jobs/taxonomy-list'
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return {title:`${slug.replaceAll('-',' ')} Recruitment`,description:'Government recruitment notifications from this organization.'}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <TaxonomyList kind="organization" slug={slug}/>}
