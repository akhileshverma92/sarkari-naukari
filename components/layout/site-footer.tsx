import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200/80 bg-[#f6f6f3] text-stone-600">
      <div className="mx-auto grid max-w-[1160px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="text-base font-bold tracking-tight text-[#171717]">
            Sarkari Naukari
          </Link>
          <p className="mt-2 max-w-xs text-xs leading-relaxed text-stone-500">
            All Government Jobs. One Platform. Verified recruitment notices, exam dates, and
            official links across India.
          </p>
        </div>

        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
            Explore
          </h3>
          <ul className="mt-3 space-y-2 text-xs">
            <li><Link href="/" className="hover:text-[#171717]">Home</Link></li>
            <li><Link href="/jobs" className="hover:text-[#171717]">Latest Jobs</Link></li>
            <li><Link href="/saved-jobs" className="hover:text-[#171717]">Saved Jobs</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
            Quick Access
          </h3>
          <ul className="mt-3 space-y-2 text-xs">
            <li><Link href="/jobs?status=open" className="hover:text-[#171717]">Open Applications</Link></li>
            <li><Link href="/jobs?deadline=7" className="hover:text-[#171717]">Closing Soon</Link></li>
            <li><Link href="/saved-jobs" className="hover:text-[#171717]">Your Shortlist</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
            Categories
          </h3>
          <ul className="mt-3 space-y-2 text-xs">
            <li><Link href="/category/central-government" className="hover:text-[#171717]">Central Govt</Link></li>
            <li><Link href="/category/state-government" className="hover:text-[#171717]">State Govt</Link></li>
            <li><Link href="/category/railway" className="hover:text-[#171717]">Railway Jobs</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-stone-200/70">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-[11px] text-stone-500 sm:px-6">
          <span>© {new Date().getFullYear()} Sarkari Naukari. All rights reserved.</span>
          <span>Always confirm details on the official recruiting website.</span>
        </div>
      </div>
    </footer>
  )
}
