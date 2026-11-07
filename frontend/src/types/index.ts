export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN';

export interface Subject {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  icon?: string | null;
  category?: string;
  teacherCount?: number;
}

export interface Me {
  id: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  status: string;
  locale: 'uz' | 'ru' | 'en';
  emailVerifiedAt?: string | null;
  createdAt?: string;
  notifyPrefs?: { email?: boolean; reminders?: boolean; messages?: boolean; marketing?: boolean } | null;
  studentProfile?: { grade?: string | null; goals?: string | null; city?: string | null } | null;
  teacherProfile?: { id: string; verification: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED'; verificationNote?: string | null; hourlyPrice: string } | null;
  appLock: { locked: boolean; deviceId: string | null; hasPin: boolean; hasBiometric: boolean; idleLockMinutes: number };
}

export interface TeacherCard {
  id: string;
  headline: string | null;
  bio: string | null;
  experienceYears: number;
  languages: string[];
  hourlyPrice: string;
  trialPrice?: string | null;
  onlineFormat: boolean;
  offlineFormat: boolean;
  city?: string | null;
  ratingAvg: string;
  ratingCount: number;
  lessonsCompleted: number;
  user: { id: string; fullName: string; avatarUrl: string | null };
  subjects: { level?: string | null; subject: Subject }[];
  availability: { weekday: number; startMinute: number; endMinute: number }[];
  isFavorite?: boolean;
  online?: boolean;
}

export interface Booking {
  id: string;
  status: 'requested' | 'confirmed' | 'rejected' | 'cancelled' | 'rescheduled' | 'completed' | 'no_show';
  price: string;
  note?: string | null;
  session: { id: string; startAt: string; endAt: string; status: string };
  lesson: { id: string; title: string; type: string; durationMin: number; subject: Subject };
  teacher: { id: string; user: { id: string; fullName: string; avatarUrl: string | null } };
  student: { id: string; fullName: string; avatarUrl: string | null };
  payments: { id: string; status: string; amount: string; provider: string }[];
  review?: { id: string; rating: number } | null;
  lessonSummary?: string | null;
  completedAt?: string | null;
}
