'use client'
import { deleteJobAction } from '@/lib/actions/jobs'
export function DeleteJobForm({id,title}:{id:string;title:string}){return <form action={deleteJobAction} onSubmit={event=>{if(!window.confirm(`Permanently delete “${title}”? Related saved-job references and history will also be removed.`))event.preventDefault()}}><input type="hidden" name="id" value={id}/><button type="submit" className="danger-action" aria-label={`Delete ${title}`}>Delete</button></form>}
