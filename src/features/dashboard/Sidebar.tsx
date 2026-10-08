import type { LucideIcon } from 'lucide-react'
import {
  ArchiveIcon,
  BookOpenIcon,
  CalendarClockIcon,
  CalendarRangeIcon,
  ChevronDownIcon,
  ClipboardCheckIcon,
  ClipboardListIcon,
  DatabaseIcon,
  GraduationCapIcon,
  IdCardIcon,
  ImageIcon,
  KeyRoundIcon,
  LibraryIcon,
  ServerCogIcon,
  ShieldCheckIcon,
  ShieldIcon,
  SchoolIcon,
  ServerIcon,
  SmartphoneIcon,
  UsersIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, useLocation } from 'react-router'
import { Logo } from '@/components/Logo'
import { useSessionUser } from '@/features/auth/AuthApi'
import type { TranslationKey } from '@/types/Route'
import { AppConfig } from '@/utils/AppConfig'
import { cn } from '@/utils/Helpers'

type NavItem = {
  to: string
  labelKey: TranslationKey
  icon: LucideIcon
  /** Custom match when the default prefix match is wrong (a parent path of another item). */
  isActive?: (pathname: string) => boolean
}

const navItems: NavItem[] = [
  { to: '/users', labelKey: 'nav.users', icon: UsersIcon },
  { to: '/profiles', labelKey: 'nav.profiles', icon: IdCardIcon },
  { to: '/banners', labelKey: 'nav.banners', icon: ImageIcon },
  { to: '/devices', labelKey: 'nav.devices', icon: SmartphoneIcon },
]

/** Admins only: math-svr answers 403 to anyone else. */
const examItems: NavItem[] = [
  {
    to: '/exams',
    labelKey: 'nav.examSittings',
    icon: ClipboardListIcon,
    // A child's work lives at /exams, /exams/journey, /exams/sitting — not the pool.
    isActive: (pathname) => pathname.startsWith('/exams') && !pathname.startsWith('/exams/pools'),
  },
  { to: '/exams/pools', labelKey: 'nav.examPools', icon: ArchiveIcon },
]

const curriculumItems: NavItem[] = [
  { to: '/curriculum/programs', labelKey: 'nav.curriculum.programs', icon: LibraryIcon },
  { to: '/curriculum/grades', labelKey: 'nav.curriculum.grades', icon: GraduationCapIcon },
  { to: '/curriculum/semesters', labelKey: 'nav.curriculum.semesters', icon: CalendarRangeIcon },
  { to: '/curriculum/schools', labelKey: 'nav.curriculum.schools', icon: SchoolIcon },
]

const permissionItems: NavItem[] = [
  { to: '/permissions/roles', labelKey: 'nav.permissions.roles', icon: ShieldCheckIcon },
]

const systemItems: NavItem[] = [
  { to: '/system/sessions', labelKey: 'nav.system.sessions', icon: KeyRoundIcon },
  { to: '/system/server', labelKey: 'nav.system.server', icon: ServerIcon },
  { to: '/system/data', labelKey: 'nav.system.data', icon: DatabaseIcon },
  { to: '/system/jobs', labelKey: 'nav.system.jobs', icon: CalendarClockIcon },
]

const linkBase = 'flex items-center gap-3 rounded-lg px-3 font-bold transition-colors'
const linkIdle = 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
const linkActive = 'bg-sidebar-primary text-sidebar-primary-foreground'

export function Sidebar() {
  const { t } = useTranslation()
  // The exams and system groups are admin-only: math-svr refuses everyone else with 403.
  const isAdmin = useSessionUser().role === 'ADMIN'

  return (
    <aside className="bg-grid-paper hidden w-62 shrink-0 flex-col gap-8 bg-sidebar px-4 py-6 text-sidebar-foreground md:flex">
      <Logo className="px-2" />
      <nav aria-label={t('nav.main')} className="flex flex-col gap-1">
        {navItems.map(({ to, labelKey, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cn(linkBase, 'h-11', isActive ? linkActive : linkIdle)}>
            <Icon className="size-5" aria-hidden />
            {t(labelKey)}
          </NavLink>
        ))}
        {isAdmin && (
          <NavGroup
            id="nav-exams"
            basePath="/exams"
            labelKey="nav.exams"
            icon={ClipboardCheckIcon}
            items={examItems}
          />
        )}
        <NavGroup
          id="nav-curriculum"
          basePath="/curriculum"
          labelKey="nav.curriculum.group"
          icon={BookOpenIcon}
          items={curriculumItems}
        />
        <NavGroup
          id="nav-permissions"
          basePath="/permissions"
          labelKey="nav.permissions.group"
          icon={ShieldIcon}
          items={permissionItems}
        />
        {isAdmin && (
          <NavGroup
            id="nav-system"
            basePath="/system"
            labelKey="nav.system.group"
            icon={ServerCogIcon}
            items={systemItems}
          />
        )}
      </nav>
      <span className="mt-auto px-3 text-xs text-sidebar-foreground/80">math-admin {AppConfig.version}</span>
    </aside>
  )
}

type NavGroupProps = {
  id: string
  /** URL prefix of the group's pages; the group is highlighted and starts open under it. */
  basePath: string
  labelKey: TranslationKey
  icon: LucideIcon
  items: NavItem[]
}

/** Collapsible sidebar section with indented links. */
function NavGroup({ id, basePath, labelKey, icon: Icon, items }: NavGroupProps) {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const inGroup = pathname.startsWith(basePath)
  // Starts open when the app loads on one of the group's pages.
  const [open, setOpen] = useState(inGroup)

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={cn(linkBase, 'h-11 w-full text-left', linkIdle, inGroup && 'text-sidebar-accent-foreground')}
      >
        <Icon className="size-5" aria-hidden />
        <span className="grow">{t(labelKey)}</span>
        <ChevronDownIcon className={cn('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div id={id} className="ml-5 flex flex-col gap-1 border-l border-sidebar-border pl-2">
          {items.map(({ to, labelKey: itemLabelKey, icon: ItemIcon, isActive: matches }) => {
            const linkClass = (active: boolean) => cn(linkBase, 'h-10 text-sm', active ? linkActive : linkIdle)
            const body = (
              <>
                <ItemIcon className="size-4" aria-hidden />
                {t(itemLabelKey)}
              </>
            )
            if (!matches) {
              return (
                <NavLink key={to} to={to} className={({ isActive }) => linkClass(isActive)}>
                  {body}
                </NavLink>
              )
            }
            // NavLink would also mark /exams active on /exams/pools (prefix match).
            const active = matches(pathname)
            return (
              <Link key={to} to={to} aria-current={active ? 'page' : undefined} className={linkClass(active)}>
                {body}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
