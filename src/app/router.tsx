import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedPortalRoute } from '../auth/ProtectedPortalRoute';
import { AppShell } from '../layouts/AppShell';
import { LoadingState } from '../components/ScreenStates';
import { adminNavItems, studentNavItems } from './routeConfig';

const AdminDashboardPage = lazy(() => import('../pages/AdminDashboardPage').then((module) => ({ default: module.AdminDashboardPage })));
const AdminAnnouncementsPage = lazy(() => import('../pages/AdminAnnouncementsPage').then((module) => ({ default: module.AdminAnnouncementsPage })));
const AdminStudentsPage = lazy(() => import('../pages/AdminStudentsPage').then((module) => ({ default: module.AdminStudentsPage })));
const AdminCohortsPage = lazy(() => import('../pages/AdminCohortsPage').then((module) => ({ default: module.AdminCohortsPage })));
const AdminProgramsPage = lazy(() => import('../pages/AdminProgramsPage').then((module) => ({ default: module.AdminProgramsPage })));
const AdminProjectsPage = lazy(() => import('../pages/AdminProjectsPage').then((module) => ({ default: module.AdminProjectsPage })));
const AdminProjectSubmissionsPage = lazy(() =>
  import('../pages/AdminProjectSubmissionsPage').then((module) => ({ default: module.AdminProjectSubmissionsPage }))
);
const AdminResourcesPage = lazy(() => import('../pages/AdminResourcesPage').then((module) => ({ default: module.AdminResourcesPage })));
const AdminWorkshopsPage = lazy(() => import('../pages/AdminWorkshopsPage').then((module) => ({ default: module.AdminWorkshopsPage })));
const AdminRecordingCandidatesPage = lazy(() =>
  import('../pages/AdminRecordingCandidatesPage').then((module) => ({ default: module.AdminRecordingCandidatesPage }))
);
const AdminCertificatesPage = lazy(() => import('../pages/AdminCertificatesPage').then((module) => ({ default: module.AdminCertificatesPage })));
const AdminCertificateRequestsPage = lazy(() =>
  import('../pages/AdminCertificateRequestsPage').then((module) => ({ default: module.AdminCertificateRequestsPage }))
);
const AdminEnrollmentsPage = lazy(() => import('../pages/AdminEnrollmentsPage').then((module) => ({ default: module.AdminEnrollmentsPage })));
const AdminEnrollmentDetailPage = lazy(() => import('../pages/AdminEnrollmentDetailPage').then((module) => ({ default: module.AdminEnrollmentDetailPage })));
const AdminEnrollmentExceptionsPage = lazy(() =>
  import('../pages/AdminEnrollmentExceptionsPage').then((module) => ({ default: module.AdminEnrollmentExceptionsPage }))
);
const AdminEnrollmentWebhookEventsPage = lazy(() =>
  import('../pages/AdminEnrollmentWebhookEventsPage').then((module) => ({ default: module.AdminEnrollmentWebhookEventsPage }))
);
const AdminPaymentOrdersPage = lazy(() => import('../pages/AdminPaymentOrdersPage').then((module) => ({ default: module.AdminPaymentOrdersPage })));
const AdminPaidAccessPage = lazy(() => import('../pages/AdminPaidAccessPage').then((module) => ({ default: module.AdminPaidAccessPage })));
const AdminSupportPage = lazy(() => import('../pages/AdminSupportPage').then((module) => ({ default: module.AdminSupportPage })));
const AdminSupportDetailPage = lazy(() => import('../pages/AdminSupportDetailPage').then((module) => ({ default: module.AdminSupportDetailPage })));
const LoginPage = lazy(() => import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ModulePlaceholderPage = lazy(() => import('../pages/ModulePlaceholderPage').then((module) => ({ default: module.ModulePlaceholderPage })));
const StudentAnnouncementsPage = lazy(() => import('../pages/StudentAnnouncementsPage').then((module) => ({ default: module.StudentAnnouncementsPage })));
const StudentCohortsPage = lazy(() => import('../pages/StudentCohortsPage').then((module) => ({ default: module.StudentCohortsPage })));
const StudentDashboardPage = lazy(() => import('../pages/StudentDashboardPage').then((module) => ({ default: module.StudentDashboardPage })));
const StudentCertificatesPage = lazy(() => import('../pages/StudentCertificatesPage').then((module) => ({ default: module.StudentCertificatesPage })));
const StudentResourcesPage = lazy(() => import('../pages/StudentResourcesPage').then((module) => ({ default: module.StudentResourcesPage })));
const StudentRecordingsPage = lazy(() => import('../pages/StudentRecordingsPage').then((module) => ({ default: module.StudentRecordingsPage })));
const StudentSchedulePage = lazy(() => import('../pages/StudentSchedulePage').then((module) => ({ default: module.StudentSchedulePage })));
const StudentProjectsPage = lazy(() => import('../pages/StudentProjectsPage').then((module) => ({ default: module.StudentProjectsPage })));
const StudentProjectSubmissionsPage = lazy(() =>
  import('../pages/StudentProjectSubmissionsPage').then((module) => ({ default: module.StudentProjectSubmissionsPage }))
);
const StudentPaymentsPage = lazy(() => import('../pages/StudentPaymentsPage').then((module) => ({ default: module.StudentPaymentsPage })));
const StudentSupportPage = lazy(() => import('../pages/StudentSupportPage').then((module) => ({ default: module.StudentSupportPage })));
const StudentSupportDetailPage = lazy(() => import('../pages/StudentSupportDetailPage').then((module) => ({ default: module.StudentSupportDetailPage })));
const UnauthorizedPage = lazy(() => import('../pages/UnauthorizedPage').then((module) => ({ default: module.UnauthorizedPage })));

function PageLoader({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/student" replace />
  },
  {
    path: '/login',
    element: (
      <PageLoader>
        <LoginPage />
      </PageLoader>
    )
  },
  {
    path: '/unauthorized',
    element: (
      <PageLoader>
        <UnauthorizedPage />
      </PageLoader>
    )
  },
  {
    path: '/student',
    element: <ProtectedPortalRoute portal="student" />,
    children: [
      {
        element: <AppShell navItems={studentNavItems} portal="student" />,
        children: [
          {
            index: true,
            element: (
              <PageLoader>
                <StudentDashboardPage />
              </PageLoader>
            )
          },
          {
            path: 'announcements',
            element: (
              <PageLoader>
                <StudentAnnouncementsPage />
              </PageLoader>
            )
          },
          {
            path: 'cohorts',
            element: (
              <PageLoader>
                <StudentCohortsPage />
              </PageLoader>
            )
          },
          {
            path: 'resources',
            element: (
              <PageLoader>
                <StudentResourcesPage />
              </PageLoader>
            )
          },
          {
            path: 'recordings',
            element: (
              <PageLoader>
                <StudentRecordingsPage />
              </PageLoader>
            )
          },
          {
            path: 'schedule',
            element: (
              <PageLoader>
                <StudentSchedulePage />
              </PageLoader>
            )
          },
          {
            path: 'projects',
            element: (
              <PageLoader>
                <StudentProjectsPage />
              </PageLoader>
            )
          },
          {
            path: 'project-submissions',
            element: (
              <PageLoader>
                <StudentProjectSubmissionsPage />
              </PageLoader>
            )
          },
          {
            path: 'certificates',
            element: (
              <PageLoader>
                <StudentCertificatesPage />
              </PageLoader>
            )
          },
          {
            path: 'payments',
            element: (
              <PageLoader>
                <StudentPaymentsPage />
              </PageLoader>
            )
          },
          {
            path: 'access',
            element: <Navigate to="/student/payments" replace />
          },
          {
            path: 'support',
            element: (
              <PageLoader>
                <StudentSupportPage />
              </PageLoader>
            )
          },
          {
            path: 'support/:ticketId',
            element: (
              <PageLoader>
                <StudentSupportDetailPage />
              </PageLoader>
            )
          },
          {
            path: ':moduleId',
            element: (
              <PageLoader>
                <ModulePlaceholderPage portal="student" />
              </PageLoader>
            )
          }
        ]
      }
    ]
  },
  {
    path: '/admin',
    element: <ProtectedPortalRoute portal="admin" />,
    children: [
      {
        element: <AppShell navItems={adminNavItems} portal="admin" />,
        children: [
          {
            index: true,
            element: (
              <PageLoader>
                <AdminDashboardPage />
              </PageLoader>
            )
          },
          {
            path: 'announcements',
            element: (
              <PageLoader>
                <AdminAnnouncementsPage />
              </PageLoader>
            )
          },
          {
            path: 'students',
            element: (
              <PageLoader>
                <AdminStudentsPage />
              </PageLoader>
            )
          },
          {
            path: 'cohorts',
            element: (
              <PageLoader>
                <AdminCohortsPage />
              </PageLoader>
            )
          },
          {
            path: 'programs',
            element: (
              <PageLoader>
                <AdminProgramsPage />
              </PageLoader>
            )
          },
          {
            path: 'projects',
            element: (
              <PageLoader>
                <AdminProjectsPage />
              </PageLoader>
            )
          },
          {
            path: 'project-submissions',
            element: (
              <PageLoader>
                <AdminProjectSubmissionsPage />
              </PageLoader>
            )
          },
          {
            path: 'resources',
            element: (
              <PageLoader>
                <AdminResourcesPage />
              </PageLoader>
            )
          },
          {
            path: 'workshops',
            element: (
              <PageLoader>
                <AdminWorkshopsPage />
              </PageLoader>
            )
          },
          {
            path: 'recording-candidates',
            element: (
              <PageLoader>
                <AdminRecordingCandidatesPage />
              </PageLoader>
            )
          },
          {
            path: 'certificates',
            element: (
              <PageLoader>
                <AdminCertificatesPage />
              </PageLoader>
            )
          },
          {
            path: 'certificate-requests',
            element: (
              <PageLoader>
                <AdminCertificateRequestsPage />
              </PageLoader>
            )
          },
          {
            path: 'enrollments',
            element: (
              <PageLoader>
                <AdminEnrollmentsPage />
              </PageLoader>
            )
          },
          {
            path: 'enrollments/:requestId',
            element: (
              <PageLoader>
                <AdminEnrollmentDetailPage />
              </PageLoader>
            )
          },
          {
            path: 'enrollment-exceptions',
            element: (
              <PageLoader>
                <AdminEnrollmentExceptionsPage />
              </PageLoader>
            )
          },
          {
            path: 'webhook-events',
            element: (
              <PageLoader>
                <AdminEnrollmentWebhookEventsPage />
              </PageLoader>
            )
          },
          {
            path: 'payment-orders',
            element: (
              <PageLoader>
                <AdminPaymentOrdersPage />
              </PageLoader>
            )
          },
          {
            path: 'paid-access',
            element: (
              <PageLoader>
                <AdminPaidAccessPage />
              </PageLoader>
            )
          },
          {
            path: 'support',
            element: (
              <PageLoader>
                <AdminSupportPage />
              </PageLoader>
            )
          },
          {
            path: 'support/:ticketId',
            element: (
              <PageLoader>
                <AdminSupportDetailPage />
              </PageLoader>
            )
          },
          {
            path: ':moduleId',
            element: (
              <PageLoader>
                <ModulePlaceholderPage portal="admin" />
              </PageLoader>
            )
          }
        ]
      }
    ]
  }
]);
