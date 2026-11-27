import Link from 'next/link'
import { Menu, Search, Bookmark } from 'lucide-react'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Latest Jobs', href: '/jobs' },
  { label: 'Saved', href: '/saved-jobs' },
]

export async function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#f6f6f3]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <Link
          href="/"
          className="text-base font-bold tracking-tight text-[#171717] transition hover:opacity-80"
        >
          Sarkari Naukari
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          {navLinks.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="rounded-full px-3.5 py-1.5 text-xs font-medium text-stone-600 transition hover:bg-white hover:text-[#171717] hover:shadow-2xs"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/jobs"
            aria-label="Search jobs"
            className="grid h-8 w-8 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-[#171717]"
          >
            <Search className="h-3.5 w-3.5" />
          </Link>

          <Link
            href="/saved-jobs"
            aria-label="Saved jobs"
            className="grid h-8 w-8 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-[#171717]"
          >
            <Bookmark className="h-3.5 w-3.5" />
          </Link>

          <details className="relative md:hidden">
            <summary
              aria-label="Open menu"
              className="grid h-8 w-8 cursor-pointer list-none place-items-center rounded-full border border-stone-200 bg-white text-[#171717]"
            >
              <Menu className="h-4 w-4" />
            </summary>
            <nav
              aria-label="Mobile navigation"
              className="absolute right-0 top-10 z-40 flex w-56 flex-col gap-1 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl"
            >
              {navLinks.map(({ label, href }) => (
                <Link
                  key={href}
                  href={href}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100 hover:text-[#171717]"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  )
}
