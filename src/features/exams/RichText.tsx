import { ShapesIcon } from 'lucide-react'

/** Question text: emoji render as text; [icon:NAME] tokens (drawn by the app) become a chip with the icon name. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[icon:[^\]]+\])/).map((part, index) => {
        const icon = part.match(/^\[icon:([^\]]+)\]$/)
        if (!icon) return part
        return (
          <span
            key={index}
            className="mx-0.5 inline-flex items-center gap-1 rounded-md bg-info-surface px-1.5 align-middle font-mono text-[13px] text-info"
          >
            <ShapesIcon className="size-3.5" aria-hidden />
            {icon[1]}
          </span>
        )
      })}
    </>
  )
}
