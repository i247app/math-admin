import { createBrowserRouter, Navigate } from 'react-router'
import type { RouteHandle } from '@/types/Route'
import AuthLayout from './(auth)/layout'
import SignInPage from './(auth)/sign-in/page'
import VerifyOtpPage from './(auth)/verify-otp/page'
import BannersPage from './(dashboard)/banners/page'
import GradesPage from './(dashboard)/curriculum/grades/page'
import ProgramsPage from './(dashboard)/curriculum/programs/page'
import SchoolsPage from './(dashboard)/curriculum/schools/page'
import SemestersPage from './(dashboard)/curriculum/semesters/page'
import DashboardLayout from './(dashboard)/layout'
import DevicesPage from './(dashboard)/devices/page'
import JourneyPage from './(dashboard)/exams/journey/page'
import ExamsPage from './(dashboard)/exams/page'
import ExamPoolsPage from './(dashboard)/exams/pools/page'
import SittingPage from './(dashboard)/exams/sitting/page'
import RolesPage from './(dashboard)/permissions/roles/page'
import ProfilesPage from './(dashboard)/profiles/page'
import DataPage from './(dashboard)/system/data/page'
import JobsPage from './(dashboard)/system/jobs/page'
import ServerPage from './(dashboard)/system/server/page'
import SessionsPage from './(dashboard)/system/sessions/page'
import UsersPage from './(dashboard)/users/page'
import NotFoundPage from './not-found'

/**
 * Route table. Folders under src/app mirror the URL; "(group)" folders share a
 * layout without adding a URL segment (same convention as SaaS-Boilerplate).
 */
export const router = createBrowserRouter([
  {
    Component: AuthLayout,
    children: [
      { path: '/sign-in', Component: SignInPage },
      { path: '/verify-otp', Component: VerifyOtpPage },
    ],
  },
  {
    Component: DashboardLayout,
    children: [
      { index: true, element: <Navigate to="/users" replace /> },
      { path: '/users', Component: UsersPage, handle: { titleKey: 'nav.users' } satisfies RouteHandle },
      { path: '/profiles', Component: ProfilesPage, handle: { titleKey: 'nav.profiles' } satisfies RouteHandle },
      { path: '/banners', Component: BannersPage, handle: { titleKey: 'nav.banners' } satisfies RouteHandle },
      { path: '/devices', Component: DevicesPage, handle: { titleKey: 'nav.devices' } satisfies RouteHandle },
      {
        // Admin-only exam screens: a child's work (list → journey → sitting) and the question pool.
        path: '/exams',
        handle: { titleKey: 'nav.exams' } satisfies RouteHandle,
        children: [
          { index: true, Component: ExamsPage },
          { path: 'journey', Component: JourneyPage, handle: { titleKey: 'exams.journey.title' } satisfies RouteHandle },
          { path: 'sitting', Component: SittingPage, handle: { titleKey: 'exams.sitting.title' } satisfies RouteHandle },
          {
            path: 'pools',
            handle: { titleKey: 'nav.examPools' } satisfies RouteHandle,
            children: [{ index: true, Component: ExamPoolsPage }],
          },
        ],
      },
      {
        // Reference data: programs, grades, semesters, schools (one shared screen, see features/curriculum).
        path: '/curriculum',
        handle: { titleKey: 'nav.curriculum.group' } satisfies RouteHandle,
        children: [
          { index: true, element: <Navigate to="/curriculum/programs" replace /> },
          { path: 'programs', Component: ProgramsPage, handle: { titleKey: 'nav.curriculum.programs' } satisfies RouteHandle },
          { path: 'grades', Component: GradesPage, handle: { titleKey: 'nav.curriculum.grades' } satisfies RouteHandle },
          { path: 'semesters', Component: SemestersPage, handle: { titleKey: 'nav.curriculum.semesters' } satisfies RouteHandle },
          { path: 'schools', Component: SchoolsPage, handle: { titleKey: 'nav.curriculum.schools' } satisfies RouteHandle },
        ],
      },
      {
        // Permission module of math-svr (internal/module/permission). Only roles exist so far.
        path: '/permissions',
        handle: { titleKey: 'nav.permissions.group' } satisfies RouteHandle,
        children: [
          { index: true, element: <Navigate to="/permissions/roles" replace /> },
          { path: 'roles', Component: RolesPage, handle: { titleKey: 'nav.permissions.roles' } satisfies RouteHandle },
        ],
      },
      {
        // Admin-only ops screens; math-svr answers 403 to anyone without the ADMIN role.
        path: '/system',
        handle: { titleKey: 'nav.system.group' } satisfies RouteHandle,
        children: [
          { index: true, element: <Navigate to="/system/sessions" replace /> },
          { path: 'sessions', Component: SessionsPage, handle: { titleKey: 'nav.system.sessions' } satisfies RouteHandle },
          { path: 'server', Component: ServerPage, handle: { titleKey: 'nav.system.server' } satisfies RouteHandle },
          { path: 'data', Component: DataPage, handle: { titleKey: 'nav.system.data' } satisfies RouteHandle },
          { path: 'jobs', Component: JobsPage, handle: { titleKey: 'nav.system.jobs' } satisfies RouteHandle },
        ],
      },
    ],
  },
  { path: '*', Component: NotFoundPage },
], {
  // The app is served under /admin/ (vite.config.ts `base`); routes stay written from the root.
  basename: import.meta.env.BASE_URL,
})
