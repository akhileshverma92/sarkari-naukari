import { TaxonomyList } from '@/components/jobs/taxonomy-list'
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return {title:`${slug.replaceAll('-',' ')} Qualification Jobs`,description:'Government jobs by minimum qualification.'}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <TaxonomyList kind="qualification" slug={slug}/>}
