'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { fsCreateDoc, fsListDocs, getCurrentUser, isAdminUser } from '@/lib/firebase/server'
import type { TaxonomyItem } from '@/lib/queries/jobs'

const webUrl = z
  .string()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), 'Use an HTTP or HTTPS URL')
  .optional()
  .or(z.literal(''))

const taxonomySchema = z.object({
  kind: z.enum(['organizations', 'states', 'job_categories', 'qualifications']),
  name: z.string().trim().min(2).max(180),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(180)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens'),
  website_url: webUrl,
  organization_type: z.string().max(80).optional(),
  description: z.string().max(1000).optional(),
})

export async function createTaxonomyAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/auth/login?next=%2Fadmin%2Ftaxonomies')
  const isAdmin = await isAdminUser(user)
  if (!isAdmin) redirect('/auth/login?next=%2Fadmin%2Ftaxonomies&error=unauthorized')

  const parsed = taxonomySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    redirect(`/admin/taxonomies?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? 'Check the form')}`)
  }

  const { kind, name, slug, website_url, organization_type, description } = parsed.data
  const existing = await fsListDocs<TaxonomyItem>(kind, user.idToken)
  if (existing.some((item) => item.slug === slug || item.name.toLowerCase() === name.toLowerCase())) {
    redirect('/admin/taxonomies?error=This+name+or+slug+already+exists.')
  }

  const now = new Date().toISOString()
  try {
    if (kind === 'organizations') {
      await fsCreateDoc(
        kind,
        {
          name,
          slug,
          website_url: website_url || null,
          organization_type: organization_type || null,
          description: description || null,
          created_at: now,
        },
        user.idToken,
      )
    } else {
      await fsCreateDoc(kind, { name, slug, created_at: now }, user.idToken)
    }
  } catch {
    redirect('/admin/taxonomies?error=Could+not+save+the+taxonomy+record.')
  }

  await fsCreateDoc(
    'admin_activity_logs',
    {
      admin_id: user.uid,
      action: 'created',
      entity_type: kind,
      details: { name, slug },
      created_at: now,
    },
    user.idToken,
  ).catch(() => {})

  revalidatePath('/')
  revalidatePath('/jobs')
  revalidatePath('/admin/taxonomies')
  redirect('/admin/taxonomies?notice=Directory+item+saved')
}
