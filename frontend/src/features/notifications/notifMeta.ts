import { Bell, CalendarCheck, CalendarX, CalendarClock, CreditCard, BookOpenCheck, MessageCircle, ShieldCheck, Star, Video } from 'lucide-react';

export function notifIcon(type: string) {
  if (type.startsWith('booking.cancelled') || type === 'booking.rejected') return CalendarX;
  if (type === 'booking.rescheduled') return CalendarClock;
  if (type.startsWith('booking')) return CalendarCheck;
  if (type.startsWith('payment')) return CreditCard;
  if (type.startsWith('homework')) return BookOpenCheck;
  if (type.startsWith('message')) return MessageCircle;
  if (type.startsWith('teacher')) return ShieldCheck;
  if (type.startsWith('review')) return Star;
  if (type.startsWith('lesson')) return Video;
  return Bell;
}
