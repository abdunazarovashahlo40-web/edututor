import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Paperclip, Send, CheckCheck, Check, ShieldAlert, FileText, MessageCircle } from 'lucide-react';
import { api, get, post, upload } from '../../services/api';
import { getSocket } from '../../services/socket';
import { useI18n } from '../../i18n';
import { useAuth } from '../../store/auth';
import { Avatar, EmptyState, ListSkeleton, Spinner } from '../../components/ui';
import { relative, time, errorText } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../utils/cn';

type Conv = { id: string; other: { id: string; fullName: string; avatarUrl: string | null; role: string }; lastMessage: any; lastMessageAt: string; unread: number };

export default function MessagesPage() {
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [sp, setSp] = useSearchParams();
  const active = sp.get('c');
  const convs = useQuery({ queryKey: ['conversations'], queryFn: () => get<Conv[]>('/messages/conversations') });
  const conv = convs.data?.find((c) => c.id === active);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const msgs = useInfiniteQuery({
    queryKey: ['messages', active],
    enabled: !!active,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api<any[]>(`/messages/conversations/${active}/messages`, { query: { before: pageParam, limit: 40 } }),
    getNextPageParam: (last) => (last.meta?.hasMore ? last.data[0]?.createdAt : undefined),
  });
  const list = msgs.data ? [...msgs.data.pages].reverse().flatMap((p) => p.data) : [];

  useEffect(() => {
    if (!active) return;
    post(`/messages/conversations/${active}/read`).then(() => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['unread'] });
    });
  }, [active, list.length, qc]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [list.length, active]);

  useEffect(() => {
    const s = getSocket();
    const onNew = (m: any) => {
      if (m.conversationId === active) qc.invalidateQueries({ queryKey: ['messages', active] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    };
    const onRead = (e: any) => e.conversationId === active && qc.invalidateQueries({ queryKey: ['messages', active] });
    let to: ReturnType<typeof setTimeout>;
    const onTyping = (e: any) => {
      if (e.conversationId !== active) return;
      setTyping(true);
      clearTimeout(to);
      to = setTimeout(() => setTyping(false), 2500);
    };
    s.on('message:new', onNew);
    s.on('message:read', onRead);
    s.on('chat:typing', onTyping);
    return () => {
      s.off('message:new', onNew);
      s.off('message:read', onRead);
      s.off('chat:typing', onTyping);
    };
  }, [active, qc]);

  const send = async (file?: File) => {
    if (!active || (!text.trim() && !file)) return;
    setSending(true);
    try {
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('body', text.trim());
        await upload(`/messages/conversations/${active}/messages`, fd);
      } else {
        await post(`/messages/conversations/${active}/messages`, { body: text.trim() });
      }
      setText('');
      qc.invalidateQueries({ queryKey: ['messages', active] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      toast('error', errorText(e, t));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="-mx-4 -mt-5 h-[calc(100svh-64px-72px)] md:-mx-8 md:-mt-7 md:h-[calc(100svh-64px)]">
      <div className="grid h-full md:grid-cols-[320px_1fr]">
        {/* suhbatlar ro'yxati */}
        <div className={cn('h-full overflow-y-auto border-r border-line bg-white', active && 'hidden md:block')}>
          <div className="sticky top-0 z-10 border-b border-line bg-white px-5 py-4 text-lg font-extrabold">{t('chat.title')}</div>
          {convs.isLoading ? (
            <div className="p-4"><ListSkeleton rows={4} /></div>
          ) : !convs.data?.length ? (
            <div className="p-4"><EmptyState title={t('chat.noConversations')} icon={<MessageCircle className="h-7 w-7" />} /></div>
          ) : (
            convs.data.map((c) => (
              <button key={c.id} onClick={() => setSp({ c: c.id })} className={cn('flex w-full items-center gap-3 border-b border-line/60 px-4 py-3 text-left transition hover:bg-brand-50/50', active === c.id && 'bg-brand-50')}>
                <Avatar name={c.other.fullName} src={c.other.avatarUrl} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{c.other.fullName}</span>
                    <span className="shrink-0 text-[11px] text-muted">{relative(c.lastMessageAt, locale)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-muted">{c.lastMessage?.body || (c.lastMessage?.attachmentUrl ? '📎' : '')}</span>
                    {c.unread > 0 && <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{c.unread}</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* chat oynasi */}
        <div className={cn('flex h-full flex-col bg-surface', !active && 'hidden md:flex')}>
          {!conv ? (
            <div className="grid flex-1 place-items-center text-muted">{active ? <Spinner /> : t('chat.empty')}</div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b border-line bg-white px-4 py-3">
                <button onClick={() => setSp({})} className="grid h-9 w-9 place-items-center rounded-lg md:hidden" aria-label="back"><ArrowLeft className="h-5 w-5" /></button>
                <Avatar name={conv.other.fullName} src={conv.other.avatarUrl} size={40} />
                <div>
                  <div className="font-bold">{conv.other.fullName}</div>
                  <div className="text-xs text-muted">{typing ? <span className="text-brand-600">{t('chat.typing')}</span> : t(`roles.${conv.other.role}`)}</div>
                </div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
                {msgs.hasNextPage && (
                  <button onClick={() => msgs.fetchNextPage()} className="mx-auto block text-xs font-bold text-brand-700">↑ {t('common.more')}</button>
                )}
                {list.map((m) => {
                  const mine = m.senderId === me?.id;
                  return (
                    <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                      <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] shadow-sm', mine ? 'rounded-br-md bg-gradient-to-br from-brand-700 to-brand-500 text-white' : 'rounded-bl-md bg-white text-ink')}>
                        {m.booking && <div className={cn('mb-1 rounded-lg px-2 py-1 text-[11px] font-bold', mine ? 'bg-white/15' : 'bg-brand-50 text-brand-700')}>📅 {m.booking.lesson.title}</div>}
                        {m.attachmentUrl && (
                          <a href={m.attachmentUrl} target="_blank" rel="noreferrer" className={cn('mb-1 flex items-center gap-1.5 text-sm font-bold underline', mine ? 'text-white' : 'text-brand-700')}>
                            <FileText className="h-4 w-4" /> {t('hw.attachment')}
                          </a>
                        )}
                        {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                        {m.body?.includes('yashirildi]') && <p className={cn('mt-1 flex items-center gap-1 text-[10px]', mine ? 'text-white/70' : 'text-muted')}><ShieldAlert className="h-3 w-3" /> {t('chat.masked')}</p>}
                        <div className={cn('mt-0.5 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-white/70' : 'text-muted')}>
                          {time(m.createdAt)}
                          {mine && (m.readAt ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottom} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="safe-bottom flex items-end gap-2 border-t border-line bg-white px-3 pt-3"
              >
                <input ref={fileRef} type="file" hidden accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => e.target.files?.[0] && send(e.target.files[0])} />
                <button type="button" onClick={() => fileRef.current?.click()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-brand-50" aria-label="attach"><Paperclip className="h-5 w-5" /></button>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    getSocket().emit('chat:typing', { conversationId: active });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={1}
                  placeholder={t('chat.placeholder')}
                  className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-500"
                />
                <button type="submit" disabled={sending || !text.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-700 text-white disabled:opacity-50" aria-label={t('common.send')}>
                  {sending ? <Spinner className="h-5 w-5 text-white" /> : <Send className="h-5 w-5" />}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
