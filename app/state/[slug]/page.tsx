import { TaxonomyList } from '@/components/jobs/taxonomy-list'
export async function generateMetadata({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return {title:`${slug.replaceAll('-',' ')} Government Jobs`,description:'Latest government job recruitment by state.'}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const {slug}=await params;return <TaxonomyList kind="state" slug={slug}/>}
