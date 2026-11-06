import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { PublicLayout } from './layouts/PublicLayout';
import { StudentLayout, TeacherLayout, AdminLayout } from './layouts/RoleLayouts';
import { GuestOnly, RequireRole } from './routes/guards';
import { AppLockGate } from './features/applock/AppLock';
import { FullPageSpinner } from './components/ui';

const Landing = lazy(() => import('./pages/public/Landing'));
const Teachers = lazy(() => import('./pages/public/Teachers'));
const TeacherProfile = lazy(() => import('./pages/public/TeacherProfile'));
const SandboxPay = lazy(() => import('./pages/public/SandboxPay'));
const ParentReport = lazy(() => import('./pages/public/ParentReport'));
const NotFound = lazy(() => import('./pages/public/NotFound'));
const Login = lazy(() => import('./features/auth/LoginPage'));
const Register = lazy(() => import('./features/auth/RegisterPage'));
const VerifyEmail = lazy(() => import('./features/auth/VerifyEmailPage'));
const ForgotPassword = lazy(() => import('./features/auth/ForgotPasswordPage'));
const VideoRoom = lazy(() => import('./features/video/VideoRoom'));
const Messages = lazy(() => import('./features/messages/MessagesPage'));
const Notifications = lazy(() => import('./features/notifications/NotificationsPage'));
const Settings = lazy(() => import('./pages/shared/Settings'));
const Homework = lazy(() => import('./pages/shared/Homework'));
const Materials = lazy(() => import('./pages/shared/Materials'));
const StudentDashboard = lazy(() => import('./pages/student/Dashboard'));
const StudentLessons = lazy(() => import('./pages/student/Lessons'));
const Progress = lazy(() => import('./pages/student/Progress'));
const Payments = lazy(() => import('./pages/student/Payments'));
const Favorites = lazy(() => import('./pages/student/Favorites'));
const TeacherOverview = lazy(() => import('./pages/teacher/Overview'));
const TeacherLessons = lazy(() => import('./pages/teacher/Lessons'));
const Schedule = lazy(() => import('./pages/teacher/Schedule'));
const Students = lazy(() => import('./pages/teacher/Students'));
const Reviews = lazy(() => import('./pages/teacher/Reviews'));
const Earnings = lazy(() => import('./pages/teacher/Earnings'));
const TeacherProfileEdit = lazy(() => import('./pages/teacher/Profile'));
const TeacherBookings = lazy(() => import('./pages/student/Lessons').then((m) => ({ default: () => <m.BookingsList as="teacher" /> })));
const Admin = {
  Dashboard: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminDashboard }))),
  Users: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminUsers }))),
  Teachers: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminTeachers }))),
  Subjects: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminSubjects }))),
  Lessons: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminLessons }))),
  Bookings: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminBookings }))),
  Payments: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminPayments }))),
  Reviews: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminReviews }))),
  Complaints: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminComplaints }))),
  Settings: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminSettings }))),
  Audit: lazy(() => import('./pages/admin/AdminPages').then((m) => ({ default: m.AdminAudit }))),
};

function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AppLockGate>
        <Suspense fallback={<FullPageSpinner />}>
          <Routes>
            <Route element={<PublicLayout />}>
              <Route index element={<Landing />} />
              <Route path="teachers" element={<Teachers />} />
              <Route path="teachers/:id" element={<TeacherProfile />} />
              <Route path="p/:token" element={<ParentReport />} />
              <Route path="pay/sandbox/:id" element={<RequireRole roles={['STUDENT']}><SandboxPay /></RequireRole>} />
            </Route>

            <Route path="login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="register" element={<GuestOnly><Register /></GuestOnly>} />
            <Route path="verify-email" element={<VerifyEmail />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="room/:sessionId" element={<RequireRole roles={['STUDENT', 'TEACHER', 'ADMIN']}><VideoRoom /></RequireRole>} />

            <Route path="student" element={<RequireRole roles={['STUDENT']}><StudentLayout /></RequireRole>}>
              <Route index element={<StudentDashboard />} />
              <Route path="lessons" element={<StudentLessons />} />
              <Route path="homework" element={<Homework />} />
              <Route path="materials" element={<Materials />} />
              <Route path="progress" element={<Progress />} />
              <Route path="messages" element={<Messages />} />
              <Route path="payments" element={<Payments />} />
              <Route path="favorites" element={<Favorites />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="teacher" element={<RequireRole roles={['TEACHER']}><TeacherLayout /></RequireRole>}>
              <Route index element={<TeacherOverview />} />
              <Route path="bookings" element={<TeacherBookings />} />
              <Route path="lessons" element={<TeacherLessons />} />
              <Route path="schedule" element={<Schedule />} />
              <Route path="students" element={<Students />} />
              <Route path="homework" element={<Homework />} />
              <Route path="materials" element={<Materials />} />
              <Route path="messages" element={<Messages />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="earnings" element={<Earnings />} />
              <Route path="profile" element={<TeacherProfileEdit />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route path="admin" element={<RequireRole roles={['ADMIN']}><AdminLayout /></RequireRole>}>
              <Route index element={<Admin.Dashboard />} />
              <Route path="users" element={<Admin.Users />} />
              <Route path="teachers" element={<Admin.Teachers />} />
              <Route path="subjects" element={<Admin.Subjects />} />
              <Route path="lessons" element={<Admin.Lessons />} />
              <Route path="bookings" element={<Admin.Bookings />} />
              <Route path="payments" element={<Admin.Payments />} />
              <Route path="reviews" element={<Admin.Reviews />} />
              <Route path="complaints" element={<Admin.Complaints />} />
              <Route path="settings" element={<Admin.Settings />} />
              <Route path="audit" element={<Admin.Audit />} />
              <Route path="messages" element={<Messages />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="account" element={<Settings />} />
            </Route>

            <Route element={<PublicLayout />}>
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      </AppLockGate>
    </BrowserRouter>
  );
}
