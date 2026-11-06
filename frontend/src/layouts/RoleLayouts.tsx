import { Home, CalendarDays, Search, BookOpenCheck, FolderOpen, BarChart3, MessageCircle, CreditCard, Bell, Heart, Settings, LayoutDashboard, PlusCircle, CalendarClock, Users, Star, Wallet, UserCircle, ShieldCheck, Layers, BookOpen, ClipboardList, Receipt, Flag, ScrollText, SlidersHorizontal, Inbox } from 'lucide-react';
import { DashboardShell } from './DashboardShell';
import { useI18n } from '../i18n';

export function StudentLayout() {
  const { t } = useI18n();
  const nav = [
    { to: '/student', label: t('menu.dashboard'), icon: Home, end: true },
    { to: '/student/lessons', label: t('menu.lessons'), icon: CalendarDays },
    { to: '/teachers', label: t('menu.findTutor'), icon: Search },
    { to: '/student/homework', label: t('menu.homework'), icon: BookOpenCheck },
    { to: '/student/materials', label: t('menu.materials'), icon: FolderOpen },
    { to: '/student/progress', label: t('menu.progress'), icon: BarChart3 },
    { to: '/student/messages', label: t('menu.messages'), icon: MessageCircle },
    { to: '/student/payments', label: t('menu.payments'), icon: CreditCard },
    { to: '/student/favorites', label: t('menu.favorites'), icon: Heart },
    { to: '/student/notifications', label: t('menu.notifications'), icon: Bell },
    { to: '/student/settings', label: t('menu.settings'), icon: Settings },
  ];
  return <DashboardShell variant="student" nav={nav} mobileNav={[nav[0], nav[1], nav[2], nav[3]]} />;
}

export function TeacherLayout() {
  const { t } = useI18n();
  const nav = [
    { to: '/teacher', label: t('menu.overview'), icon: LayoutDashboard, end: true },
    { to: '/teacher/bookings', label: t('menu.bookings'), icon: Inbox },
    { to: '/teacher/lessons', label: t('menu.myLessons'), icon: BookOpen },
    { to: '/teacher/lessons?new=1', label: t('lesson.new'), icon: PlusCircle },
    { to: '/teacher/schedule', label: t('menu.schedule'), icon: CalendarClock },
    { to: '/teacher/students', label: t('menu.students'), icon: Users },
    { to: '/teacher/homework', label: t('menu.homework'), icon: BookOpenCheck },
    { to: '/teacher/materials', label: t('menu.materials'), icon: FolderOpen },
    { to: '/teacher/messages', label: t('menu.messages'), icon: MessageCircle },
    { to: '/teacher/reviews', label: t('menu.reviews'), icon: Star },
    { to: '/teacher/earnings', label: t('menu.earnings'), icon: Wallet },
    { to: '/teacher/profile', label: t('menu.profile'), icon: UserCircle },
    { to: '/teacher/settings', label: t('menu.settings'), icon: Settings },
  ];
  return <DashboardShell variant="teacher" nav={nav} mobileNav={[nav[0], nav[4], nav[1], nav[8]]} />;
}

export function AdminLayout() {
  const { t } = useI18n();
  const nav = [
    { to: '/admin', label: t('menu.dashboard'), icon: LayoutDashboard, end: true },
    { group: t('menu.users') },
    { to: '/admin/users', label: t('menu.users'), icon: Users },
    { to: '/admin/teachers', label: t('menu.verification'), icon: ShieldCheck },
    { group: t('menu.adminLessons') },
    { to: '/admin/subjects', label: t('menu.subjects'), icon: Layers },
    { to: '/admin/lessons', label: t('menu.adminLessons'), icon: BookOpen },
    { to: '/admin/bookings', label: t('menu.adminBookings'), icon: ClipboardList },
    { group: t('menu.adminPayments') },
    { to: '/admin/payments', label: t('menu.adminPayments'), icon: Receipt },
    { to: '/admin/reviews', label: t('menu.reviews'), icon: Star },
    { to: '/admin/complaints', label: t('menu.complaints'), icon: Flag },
    { group: t('menu.settings') },
    { to: '/admin/settings', label: t('menu.settings'), icon: SlidersHorizontal },
    { to: '/admin/audit', label: t('menu.audit'), icon: ScrollText },
    { to: '/admin/messages', label: t('menu.messages'), icon: MessageCircle },
  ];
  return <DashboardShell variant="admin" nav={nav} mobileNav={[]} />;
}
