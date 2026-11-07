import type { ComponentType } from 'react';
import { Bell, Globe, Lock, ShieldCheck, Trash2, UserRound } from 'lucide-react';

/** Sozlamalar bo'limlari (Sozlamalar sahifasi va profil menyusi uchun umumiy) */
export const SETTINGS_TABS = ['profile', 'security', 'applock', 'notifications', 'language', 'privacy'] as const;
export type SettingsTab = (typeof SETTINGS_TABS)[number];
export const TAB_ICONS: Record<SettingsTab, ComponentType<{ className?: string }>> = {
  profile: UserRound,
  security: ShieldCheck,
  applock: Lock,
  notifications: Bell,
  language: Globe,
  privacy: Trash2,
};
