import Link from 'next/link'
import { Compass } from 'lucide-react'

export function Logo({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span
        className={`flex size-9 items-center justify-center rounded-md ${
          inverted ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'
        }`}
      >
        <Compass className="size-5" strokeWidth={2.2} />
      </span>
      <span className="font-display text-lg font-extrabold leading-none tracking-tight">
        <span className={inverted ? 'text-primary-foreground' : 'text-foreground'}>EF</span>{' '}
        <span className="text-accent">A&E</span>
        <span className="block text-[11px] font-medium tracking-wide text-muted-foreground">
          Report Portal
        </span>
      </span>
    </Link>
  )
}
