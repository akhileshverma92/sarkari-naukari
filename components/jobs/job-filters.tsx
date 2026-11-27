'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import type { TaxonomyItem } from '@/lib/queries/jobs'

export function JobFilters({
  taxonomies,
  current,
  activeCount,
}: {
  taxonomies: {
    states: TaxonomyItem[]
    categories: TaxonomyItem[]
    organizations: TaxonomyItem[]
    qualifications: TaxonomyItem[]
  }
  current: {
    q?: string
    state?: string
    category?: string
    organization?: string
    qualification?: string
    status?: string
    deadline?: string
  }
  activeCount: number
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-[#171717] shadow-2xs transition hover:border-stone-300 hover:bg-stone-50"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-[#171717] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-stone-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {activeCount > 0 && (
          <Link
            href="/jobs"
            className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-stone-600 hover:text-[#171717]"
          >
            <X className="h-3.5 w-3.5" /> Clear all
          </Link>
        )}
      </div>

      {open && (
        <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs sm:p-5">
          <form action="/jobs" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="q" value={current.q ?? ''} />

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-600">
              State
              <select
                name="state"
                defaultValue={current.state ?? ''}
                className="h-9 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs text-[#171717]"
              >
                <option value="">All states</option>
                {taxonomies.states.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-600">
              Category
              <select
                name="category"
                defaultValue={current.category ?? ''}
                className="h-9 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs text-[#171717]"
              >
                <option value="">All categories</option>
                {taxonomies.categories.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-600">
              Organization
              <select
                name="organization"
                defaultValue={current.organization ?? ''}
                className="h-9 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs text-[#171717]"
              >
                <option value="">All organizations</option>
                {taxonomies.organizations.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-600">
              Qualification
              <select
                name="qualification"
                defaultValue={current.qualification ?? ''}
                className="h-9 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs text-[#171717]"
              >
                <option value="">All qualifications</option>
                {taxonomies.qualifications.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-600">
              Application status
              <select
                name="status"
                defaultValue={current.status ?? ''}
                className="h-9 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs text-[#171717]"
              >
                <option value="">Any status</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-[11px] font-semibold text-stone-600">
              Application deadline
              <select
                name="deadline"
                defaultValue={current.deadline ?? ''}
                className="h-9 rounded-xl border border-stone-200 bg-stone-50 px-3 text-xs text-[#171717]"
              >
                <option value="">Any deadline</option>
                <option value="7">Within 7 days</option>
                <option value="30">Within 30 days</option>
                <option value="expired">Expired</option>
              </select>
            </label>

            <div className="flex items-end justify-end gap-2 sm:col-span-2 lg:col-span-3">
              <button
                type="submit"
                className="rounded-full bg-[#171717] px-5 py-2 text-xs font-semibold text-white transition hover:bg-stone-800"
              >
                Apply filters
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
