import { lazy, ReactNode, Suspense } from 'react';
import { createBrowserRouter, isRouteErrorResponse, Navigate, useRouteError } from 'react-router-dom';
import { ProtectedPortalRoute } from '../auth/ProtectedPortalRoute';
import { AdminPermissionGate } from '../auth/AdminPermissionGate';
import { AppShell } from '../layouts/AppShell';
import { LoadingState } from '../components/ScreenStates';
import { StudentFeatureGate } from '../components/StudentFeatureGate';
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
const AdminFeatureControlPage = lazy(() => import('../pages/AdminFeatureControlPage').then((module) => ({ default: module.AdminFeatureControlPage })));
const AdminUsersPage = lazy(() => import('../pages/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AdminEmailCenterPage = lazy(() => import('../pages/AdminEmailCenterPage').then((module) => ({ default: module.AdminEmailCenterPage })));
const AdminObservabilityPage = lazy(() => import('../pages/AdminObservabilityPage').then((module) => ({ default: module.AdminObservabilityPage })));
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

function StudentFeaturePage({ children, moduleId }: { children: ReactNode; moduleId: string }) {
  return <StudentFeatureGate moduleId={moduleId}>{children}</StudentFeatureGate>;
}

function AdminFeaturePage({ children, moduleId }: { children: ReactNode; moduleId: string }) {
  return <AdminPermissionGate moduleId={moduleId}>{children}</AdminPermissionGate>;
}

function RouteErrorFallback() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error)
    ? error.statusText
    : error instanceof Error
      ? error.message
      : 'This page could not be loaded.';
  const isChunkLoadError = /dynamically imported module|loading chunk|failed to fetch/i.test(message);

  return (
    <main className="page-frame route-error-page">
      <section className="route-error-card">
        <span className="section-eyebrow">Portal Refresh</span>
        <h1>{isChunkLoadError ? 'Page update available' : 'Page could not load'}</h1>
        <p>
          {isChunkLoadError
            ? 'A newer portal version is available. Refresh this page to load the latest files.'
            : 'Something interrupted this page load. Refresh the page and try again.'}
        </p>
        <button className="announcement-primary-button" onClick={() => window.location.reload()} type="button">
          Refresh page
        </button>
      </section>
    </main>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/student" replace />,
    errorElement: <RouteErrorFallback />
  },
  {
    path: '/login',
    element: (
      <PageLoader>
        <LoginPage />
      </PageLoader>
    ),
    errorElement: <RouteErrorFallback />
  },
  {
    path: '/unauthorized',
    element: (
      <PageLoader>
        <UnauthorizedPage />
      </PageLoader>
    ),
    errorElement: <RouteErrorFallback />
  },
  {
    path: '/student',
    element: <ProtectedPortalRoute portal="student" />,
    errorElement: <RouteErrorFallback />,
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
                <StudentFeaturePage moduleId="announcements">
                  <StudentAnnouncementsPage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'cohorts',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="cohorts">
                  <StudentCohortsPage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'resources',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="resources">
                  <StudentResourcesPage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'recordings',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="recordings">
                  <StudentRecordingsPage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'schedule',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="schedule">
                  <StudentSchedulePage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'projects',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="projects">
                  <StudentProjectsPage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'project-submissions',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="project-submissions">
                  <StudentProjectSubmissionsPage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'certificates',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="certificates">
                  <StudentCertificatesPage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'payments',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="payments">
                  <StudentPaymentsPage />
                </StudentFeaturePage>
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
                <StudentFeaturePage moduleId="support">
                  <StudentSupportPage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'support/:ticketId',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="support">
                  <StudentSupportDetailPage />
                </StudentFeaturePage>
              </PageLoader>
            )
          },
          {
            path: ':moduleId',
            element: (
              <PageLoader>
                <StudentFeaturePage moduleId="community">
                  <ModulePlaceholderPage portal="student" />
                </StudentFeaturePage>
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
    errorElement: <RouteErrorFallback />,
    children: [
      {
        element: <AppShell navItems={adminNavItems} portal="admin" />,
        children: [
          {
            index: true,
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="dashboard">
                  <AdminDashboardPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'announcements',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="announcements">
                  <AdminAnnouncementsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'students',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="students">
                  <AdminStudentsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'cohorts',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="cohorts">
                  <AdminCohortsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'programs',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="programs">
                  <AdminProgramsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'projects',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="projects">
                  <AdminProjectsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'project-submissions',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="project-submissions">
                  <AdminProjectSubmissionsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'resources',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="resources">
                  <AdminResourcesPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'workshops',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="workshops">
                  <AdminWorkshopsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'recording-candidates',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="recording-candidates">
                  <AdminRecordingCandidatesPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'certificates',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="certificates">
                  <AdminCertificatesPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'certificate-requests',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="certificates">
                  <AdminCertificateRequestsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'enrollments',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="enrollments">
                  <AdminEnrollmentsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'enrollments/:requestId',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="enrollments">
                  <AdminEnrollmentDetailPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'enrollment-exceptions',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="enrollments">
                  <AdminEnrollmentExceptionsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'webhook-events',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="enrollments">
                  <AdminEnrollmentWebhookEventsPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'payment-orders',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="payment-orders">
                  <AdminPaymentOrdersPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'paid-access',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="paid-access">
                  <AdminPaidAccessPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'support',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="support">
                  <AdminSupportPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'support/:ticketId',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="support">
                  <AdminSupportDetailPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'email-center',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="email-center">
                  <AdminEmailCenterPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'feature-control',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="feature-control">
                  <AdminFeatureControlPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'admin-users',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="admin-users">
                  <AdminUsersPage />
                </AdminFeaturePage>
              </PageLoader>
            )
          },
          {
            path: 'observability',
            element: (
              <PageLoader>
                <AdminFeaturePage moduleId="observability">
                  <AdminObservabilityPage />
                </AdminFeaturePage>
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
