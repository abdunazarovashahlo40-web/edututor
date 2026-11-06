/**
 * Video dars xonasi — WebRTC (mesh, 2–8 ishtirokchi) + Socket.IO signalizatsiya.
 * "Perfect negotiation" naqshi: ikki tomon ham bir vaqtda offer yuborsa to'qnashuv to'g'ri hal qilinadi.
 * Provayder "jitsi" bo'lsa — Jitsi Meet iframe.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Users, MessageSquare, Play, Square, Wifi, WifiOff, Loader2, X, Send, ExternalLink, PenLine, Gauge } from 'lucide-react';
import { Whiteboard } from './Whiteboard';
import { ApiError, get, post } from '../../services/api';
import { connectSocket } from '../../services/socket';
import { useI18n } from '../../i18n';
import { useAuth } from '../../store/auth';
import { Avatar, Button, ErrorState, FullPageSpinner } from '../../components/ui';
import { LogoMark } from '../../components/Logo';
import { dateTime, errorText, time } from '../../utils/format';
import { useToast } from '../../hooks/useToast';
import { cn } from '../../utils/cn';

type Media = { audio: boolean; video: boolean; screen?: boolean };
type Remote = { socketId: string; user: { id: string; fullName: string }; stream: MediaStream | null; state: RTCPeerConnectionState | 'new'; media: Media };
type PeerRec = { pc: RTCPeerConnection; polite: boolean; makingOffer: boolean; ignoreOffer: boolean };

export default function VideoRoom() {
  const { sessionId } = useParams();
  const { t, locale } = useI18n();
  const { me } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const info = useQuery({ queryKey: ['meeting', sessionId], queryFn: () => get<any>(`/meetings/session/${sessionId}`), retry: false });

  const localRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const cameraTrack = useRef<MediaStreamTrack | null>(null);
  const peers = useRef(new Map<string, PeerRec>());
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [media, setMedia] = useState<Media>({ audio: true, video: true });
  const [joined, setJoined] = useState(false);
  const [permErr, setPermErr] = useState(false);
  const [panel, setPanel] = useState<'people' | 'chat' | null>(null);
  const [chat, setChat] = useState<{ from: { fullName: string; id: string }; text: string; at: number }[]>([]);
  const [msg, setMsg] = useState('');
  const [status, setStatus] = useState<string>('scheduled');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [board, setBoard] = useState(false);
  const [lowBw, setLowBw] = useState(false);

  const upsertRemote = useCallback((socketId: string, patch: Partial<Remote>) => {
    setRemotes((rs) => {
      const i = rs.findIndex((r) => r.socketId === socketId);
      if (i === -1) return [...rs, { socketId, user: { id: '', fullName: '…' }, stream: null, state: 'new', media: { audio: true, video: true }, ...patch }];
      const n = [...rs];
      n[i] = { ...n[i], ...patch };
      return n;
    });
  }, []);

  const createPeer = useCallback(
    (socketId: string, user: Remote['user'], iceServers: RTCIceServer[]) => {
      const s = connectSocket();
      const pc = new RTCPeerConnection({ iceServers });
      const rec: PeerRec = { pc, polite: (s.id ?? '') > socketId, makingOffer: false, ignoreOffer: false };
      peers.current.set(socketId, rec);
      localStream.current?.getTracks().forEach((tr) => pc.addTrack(tr, localStream.current!));
      if (!localStream.current?.getVideoTracks().length) pc.addTransceiver('video', { direction: 'recvonly' });
      if (!localStream.current?.getAudioTracks().length) pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.onnegotiationneeded = async () => {
        try {
          rec.makingOffer = true;
          await pc.setLocalDescription();
          s.emit('rtc:signal', { to: socketId, data: { description: pc.localDescription } });
        } catch (e) {
          console.warn(e);
        } finally {
          rec.makingOffer = false;
        }
      };
      pc.onicecandidate = (e) => e.candidate && s.emit('rtc:signal', { to: socketId, data: { candidate: e.candidate } });
      pc.ontrack = (e) => upsertRemote(socketId, { stream: e.streams[0] ?? new MediaStream([e.track]) });
      pc.onconnectionstatechange = () => {
        upsertRemote(socketId, { state: pc.connectionState });
        if (pc.connectionState === 'failed') pc.restartIce();
      };
      upsertRemote(socketId, { user });
      return rec;
    },
    [upsertRemote],
  );

  const closePeer = useCallback((socketId: string) => {
    peers.current.get(socketId)?.pc.close();
    peers.current.delete(socketId);
    setRemotes((rs) => rs.filter((r) => r.socketId !== socketId));
  }, []);

  // Media va xonaga ulanish
  useEffect(() => {
    const d = info.data;
    if (!d || d.provider !== 'webrtc') return;
    setStatus(d.status);
    let cancelled = false;
    const s = connectSocket();

    const onSignal = async ({ from, user, data }: any) => {
      const rec = peers.current.get(from) ?? createPeer(from, user, d.iceServers);
      const pc = rec.pc;
      try {
        if (data.description) {
          const desc = data.description as RTCSessionDescriptionInit;
          const collision = desc.type === 'offer' && (rec.makingOffer || pc.signalingState !== 'stable');
          rec.ignoreOffer = !rec.polite && collision;
          if (rec.ignoreOffer) return;
          await pc.setRemoteDescription(desc);
          if (desc.type === 'offer') {
            await pc.setLocalDescription();
            s.emit('rtc:signal', { to: from, data: { description: pc.localDescription } });
          }
        } else if (data.candidate) {
          try {
            await pc.addIceCandidate(data.candidate);
          } catch (e) {
            if (!rec.ignoreOffer) throw e;
          }
        }
      } catch (e) {
        console.warn('signal error', e);
      }
    };
    const onJoined = ({ socketId, user, media: m }: any) => {
      createPeer(socketId, user, d.iceServers);
      upsertRemote(socketId, { media: m });
    };
    const onLeft = ({ socketId }: any) => closePeer(socketId);
    const onMedia = ({ socketId, media: m }: any) => upsertRemote(socketId, { media: m });
    const onChat = (c: any) => setChat((x) => [...x.slice(-99), c]);

    (async () => {
      try {
        localStream.current = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        try {
          localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
          setMedia((m) => ({ ...m, video: false }));
        } catch {
          setPermErr(true);
          setMedia({ audio: false, video: false });
        }
      }
      if (cancelled) return localStream.current?.getTracks().forEach((tr) => tr.stop());
      cameraTrack.current = localStream.current?.getVideoTracks()[0] ?? null;
      if (localRef.current && localStream.current) localRef.current.srcObject = localStream.current;

      s.on('rtc:signal', onSignal);
      s.on('room:peer-joined', onJoined);
      s.on('room:peer-left', onLeft);
      s.on('room:media', onMedia);
      s.on('room:chat', onChat);
      const join = () =>
        s.emit('room:join', { roomKey: d.roomKey }, (r: any) => {
          if (!r?.ok) return setJoinErr(r?.error ?? 'FORBIDDEN');
          setJoined(true);
          for (const p of r.peers) {
            createPeer(p.socketId, p.user, d.iceServers);
            upsertRemote(p.socketId, { media: p.media });
          }
        });
      if (s.connected) join();
      else s.once('connect', join);
    })();

    return () => {
      cancelled = true;
      s.emit('room:leave');
      s.off('rtc:signal', onSignal);
      s.off('room:peer-joined', onJoined);
      s.off('room:peer-left', onLeft);
      s.off('room:media', onMedia);
      s.off('room:chat', onChat);
      peers.current.forEach((p) => p.pc.close());
      peers.current.clear();
      localStream.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [info.data, createPeer, closePeer, upsertRemote]);

  const broadcastMedia = (m: Media) => connectSocket().emit('room:media', m);

  const toggleAudio = () => {
    const tr = localStream.current?.getAudioTracks()[0];
    if (!tr) return;
    tr.enabled = !tr.enabled;
    const m = { ...media, audio: tr.enabled };
    setMedia(m);
    broadcastMedia(m);
  };
  const toggleVideo = () => {
    const tr = cameraTrack.current;
    if (!tr) return;
    tr.enabled = !tr.enabled;
    const m = { ...media, video: tr.enabled };
    setMedia(m);
    broadcastMedia(m);
  };

  const replaceVideo = async (track: MediaStreamTrack | null) => {
    for (const { pc } of peers.current.values()) {
      const tr = pc.getTransceivers().find((x) => x.receiver.track?.kind === 'video');
      if (!tr) {
        if (track && localStream.current) pc.addTrack(track, localStream.current);
        continue;
      }
      if (track && (tr.direction === 'recvonly' || tr.direction === 'inactive')) tr.direction = 'sendrecv';
      await tr.sender.replaceTrack(track);
    }
  };

  const toggleScreen = async () => {
    if (media.screen) {
      await replaceVideo(cameraTrack.current);
      if (localRef.current && localStream.current) localRef.current.srcObject = localStream.current;
      const m = { ...media, screen: false };
      setMedia(m);
      broadcastMedia(m);
      return;
    }
    try {
      const ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const track = ds.getVideoTracks()[0];
      await replaceVideo(track);
      if (localRef.current) localRef.current.srcObject = ds;
      track.onended = () => void toggleScreenOff();
      const m = { ...media, screen: true };
      setMedia(m);
      broadcastMedia(m);
    } catch {
      /* bekor qilindi yoki qo'llab-quvvatlanmaydi */
    }
  };
  const toggleScreenOff = async () => {
    await replaceVideo(cameraTrack.current);
    if (localRef.current && localStream.current) localRef.current.srcObject = localStream.current;
    setMedia((m) => {
      const n = { ...m, screen: false };
      broadcastMedia(n);
      return n;
    });
  };

  /** Sekin internet rejimi: kamera sifati va uzatish tezligi pasaytiriladi, ovoz ustuvor qoladi */
  const toggleLowBandwidth = async () => {
    const on = !lowBw;
    setLowBw(on);
    try {
      await cameraTrack.current?.applyConstraints(
        on ? { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { max: 12 } } : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      );
    } catch {
      /* ba'zi qurilmalar qo'llab-quvvatlamaydi */
    }
    for (const { pc } of peers.current.values()) {
      for (const sender of pc.getSenders()) {
        if (sender.track?.kind !== 'video') continue;
        const p = sender.getParameters();
        if (!p.encodings?.length) p.encodings = [{}];
        p.encodings[0].maxBitrate = on ? 150_000 : undefined;
        try {
          await sender.setParameters(p);
        } catch {
          /* e'tiborsiz */
        }
      }
    }
    toast('success', on ? t('room.lowBwOn') : t('room.lowBwOff'));
  };

  const startLesson = async () => {
    try {
      await post(`/meetings/session/${sessionId}/start`);
      setStatus('in_progress');
    } catch (e) {
      toast('error', errorText(e, t));
    }
  };
  const endLesson = async () => {
    if (!confirm(t('room.endConfirm'))) return;
    try {
      await post(`/meetings/session/${sessionId}/end`);
      nav(-1);
    } catch (e) {
      toast('error', errorText(e, t));
    }
  };

  if (info.isLoading) return <FullPageSpinner />;
  if (info.isError) {
    const e = info.error as ApiError;
    return (
      <div className="grid min-h-[100svh] place-items-center bg-surface px-4">
        <div className="w-full max-w-md">
          <ErrorState text={e.code === 'ROOM_CLOSED' ? t('room.closed') : errorText(e, t)} onRetry={() => info.refetch()} retryLabel={t('common.retry')} />
          <Button variant="ghost" className="mt-3 w-full" onClick={() => nav(-1)}>{t('common.back')}</Button>
        </div>
      </div>
    );
  }
  const d = info.data;

  if (d.provider === 'jitsi') {
    return (
      <div className="flex h-[100svh] flex-col bg-navy-900">
        <div className="flex items-center gap-3 px-4 py-3 text-white">
          <LogoMark />
          <div className="flex-1 truncate font-bold">{d.lesson.title}</div>
          <a href={d.externalUrl} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary" icon={<ExternalLink className="h-4 w-4" />}>{t('room.openExternal')}</Button></a>
          {d.isTeacher && <Button size="sm" variant="danger" onClick={endLesson}>{t('room.end')}</Button>}
          <Button size="sm" variant="ghost" className="text-white" onClick={() => nav(-1)}>{t('room.leave')}</Button>
        </div>
        <iframe title="lesson" src={`${d.externalUrl}#userInfo.displayName="${encodeURIComponent(me?.fullName ?? '')}"`} allow="camera; microphone; display-capture; fullscreen; autoplay" className="flex-1 border-0" />
      </div>
    );
  }

  const tiles = remotes;
  return (
    <div className="relative flex h-[100svh] flex-col overflow-hidden bg-[#0B0F1E] text-white">
      {/* yuqori panel */}
      <div className="z-20 flex items-center gap-3 px-4 py-3">
        <button onClick={() => nav(-1)} className="grid h-9 w-9 place-items-center rounded-xl bg-white/10" aria-label={t('common.back')}><X className="h-5 w-5" /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{d.lesson.title}</div>
          <div className="text-xs text-white/60">{dateTime(d.startAt, locale)} – {time(d.endAt)} · {status === 'in_progress' ? <span className="text-green-400">● LIVE</span> : t(`lesson.statuses.${status}`)}</div>
        </div>
        <button
          onClick={toggleLowBandwidth}
          className={cn('flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold transition', lowBw ? 'bg-amber-400 text-navy-900' : 'bg-white/10 text-white/80 hover:bg-white/20')}
          title={t('room.lowBw')}
          aria-pressed={lowBw}
        >
          <Gauge className="h-4 w-4" /> <span className="hidden sm:inline">{t('room.lowBw')}</span>
        </button>
        {d.isTeacher && (status === 'in_progress' ? (
          <Button size="sm" variant="danger" icon={<Square className="h-4 w-4" />} onClick={endLesson}>{t('room.end')}</Button>
        ) : (
          <Button size="sm" variant="success" icon={<Play className="h-4 w-4" />} onClick={startLesson}>{t('room.start')}</Button>
        ))}
      </div>

      {permErr && <div className="z-20 mx-4 mb-2 rounded-xl bg-amber-500/15 px-3 py-2 text-sm text-amber-200">{t('room.permission')}</div>}
      {joinErr && <div className="z-20 mx-4 mb-2 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{joinErr}</div>}

      {/* video tile'lar */}
      <div className="relative flex-1 overflow-hidden px-3 pb-28 md:px-4">
        {tiles.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <div className="mx-auto mb-4 flex -space-x-3">
                <Avatar name={d.teacher.fullName} src={d.teacher.avatarUrl} size={64} />
                {d.students.slice(0, 3).map((s: any) => <Avatar key={s.id} name={s.fullName} src={s.avatarUrl} size={64} />)}
              </div>
              <p className="flex items-center gap-2 text-white/70">{joined ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{joined ? t('room.waiting') : t('room.connecting')}</p>
            </div>
          </div>
        ) : (
          <div className={cn('grid h-full gap-3', tiles.length === 1 ? 'grid-cols-1' : tiles.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2 md:grid-cols-3')}>
            {tiles.map((r) => <RemoteTile key={r.socketId} r={r} />)}
          </div>
        )}
        {board && joined && <div className="absolute inset-x-3 bottom-28 top-0 md:inset-x-4"><Whiteboard isTeacher={!!d.isTeacher} onClose={() => setBoard(false)} /></div>}
        {/* o'z videom (PiP) */}
        <motion.div drag dragMomentum={false} className="absolute bottom-32 right-4 z-10 h-36 w-28 cursor-move overflow-hidden rounded-2xl border-2 border-white/30 bg-navy-800 shadow-2xl md:bottom-28 md:h-40 md:w-60">
          <video ref={localRef} autoPlay playsInline muted className={cn('h-full w-full object-cover', !media.screen && '-scale-x-100', !media.video && !media.screen && 'hidden')} />
          {!media.video && !media.screen && <div className="grid h-full place-items-center"><Avatar name={me?.fullName} src={me?.avatarUrl} size={56} /></div>}
          <span className="absolute bottom-1.5 left-2 rounded-md bg-black/50 px-1.5 text-[11px] font-bold">{t('room.you')}</span>
          {!media.audio && <MicOff className="absolute right-2 top-2 h-4 w-4 text-red-400" />}
        </motion.div>
      </div>

      {/* boshqaruv paneli */}
      <div className="safe-bottom absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-4 pt-6">
        <div className="mx-auto flex max-w-lg items-center justify-center gap-1.5 md:gap-3">
          <Ctrl on={media.audio} onClick={toggleAudio} label={t('room.mic')} icon={media.audio ? Mic : MicOff} />
          <Ctrl on={media.video} onClick={toggleVideo} label={t('room.cam')} icon={media.video ? Video : VideoOff} />
          {'getDisplayMedia' in (navigator.mediaDevices ?? {}) && <Ctrl on={!media.screen} onClick={toggleScreen} label={t('room.screen')} icon={MonitorUp} active={media.screen} />}
          <Ctrl on={!board} onClick={() => setBoard((b) => !b)} label={t('room.whiteboard')} icon={PenLine} active={board} />
          <Ctrl on onClick={() => setPanel(panel === 'people' ? null : 'people')} label={t('room.participants')} icon={Users} badge={tiles.length + 1} />
          <Ctrl on onClick={() => setPanel(panel === 'chat' ? null : 'chat')} label={t('room.chat')} icon={MessageSquare} badge={chat.length || undefined} />
          <button onClick={() => nav(-1)} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-red-500 shadow-lg active:scale-95 md:h-14 md:w-14" aria-label={t('room.leave')}><PhoneOff className="h-6 w-6" /></button>
        </div>
      </div>

      {/* yon panel */}
      <AnimatePresence>
        {panel && (
          <motion.aside initial={{ x: 380 }} animate={{ x: 0 }} exit={{ x: 380 }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} className="absolute bottom-0 right-0 top-0 z-30 flex w-full max-w-sm flex-col bg-white text-ink">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <span className="font-extrabold">{panel === 'people' ? t('room.participants') : t('room.chat')}</span>
              <button onClick={() => setPanel(null)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100" aria-label="close"><X className="h-5 w-5" /></button>
            </div>
            {panel === 'people' ? (
              <div className="space-y-1 p-3">
                <PersonRow name={`${me?.fullName} (${t('room.you')})`} avatar={me?.avatarUrl} media={media} state="connected" />
                {tiles.map((r) => <PersonRow key={r.socketId} name={r.user.fullName} media={r.media} state={r.state} />)}
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-2 overflow-y-auto p-3">
                  {chat.map((c, i) => (
                    <div key={i} className={cn('rounded-xl px-3 py-2 text-sm', c.from.id === me?.id ? 'ml-8 bg-brand-600 text-white' : 'mr-8 bg-slate-100')}>
                      <div className="text-[11px] font-bold opacity-70">{c.from.fullName}</div>
                      {c.text}
                    </div>
                  ))}
                </div>
                <form onSubmit={(e) => { e.preventDefault(); if (msg.trim()) { connectSocket().emit('room:chat', msg.trim()); setMsg(''); } }} className="safe-bottom flex gap-2 border-t border-line p-3">
                  <input value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t('room.typeMessage')} className="h-11 flex-1 rounded-xl border border-line px-3 outline-none focus:border-brand-500" />
                  <button className="grid h-11 w-11 place-items-center rounded-xl bg-brand-700 text-white" aria-label={t('common.send')}><Send className="h-5 w-5" /></button>
                </form>
              </>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );

  function PersonRow({ name, avatar, media: m, state }: { name: string; avatar?: string | null; media: Media; state: string }) {
    return (
      <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50">
        <Avatar name={name} src={avatar} size={36} />
        <span className="flex-1 truncate text-sm font-semibold">{name}</span>
        {m.audio ? <Mic className="h-4 w-4 text-muted" /> : <MicOff className="h-4 w-4 text-danger" />}
        {m.video ? <Video className="h-4 w-4 text-muted" /> : <VideoOff className="h-4 w-4 text-danger" />}
        {state === 'connected' ? <Wifi className="h-4 w-4 text-success" /> : state === 'failed' || state === 'disconnected' ? <WifiOff className="h-4 w-4 text-danger" /> : <Loader2 className="h-4 w-4 animate-spin text-muted" />}
      </div>
    );
  }
}

function RemoteTile({ r }: { r: Remote }) {
  const { t } = useI18n();
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current && r.stream && ref.current.srcObject !== r.stream) ref.current.srcObject = r.stream;
  }, [r.stream]);
  const showVideo = r.stream && (r.media.video || r.media.screen);
  return (
    <div className="relative min-h-[180px] overflow-hidden rounded-3xl bg-navy-800">
      <video ref={ref} autoPlay playsInline className={cn('h-full w-full', r.media.screen ? 'object-contain' : 'object-cover', !showVideo && 'invisible')} />
      {!showVideo && <div className="absolute inset-0 grid place-items-center"><Avatar name={r.user.fullName} size={88} /></div>}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-black/50 px-2.5 py-1 text-xs font-bold backdrop-blur">
        {!r.media.audio && <MicOff className="h-3.5 w-3.5 text-red-400" />}
        {r.user.fullName}
      </div>
      {r.state !== 'connected' && (
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-xl bg-black/50 px-2.5 py-1 text-[11px] font-bold">
          {r.state === 'failed' || r.state === 'disconnected' ? <><WifiOff className="h-3.5 w-3.5 text-red-400" /> {t('room.failed')}</> : <><Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('room.connecting')}</>}
        </div>
      )}
    </div>
  );
}

function Ctrl({ on, onClick, label, icon: I, badge, active }: { on: boolean; onClick: () => void; label: string; icon: any; badge?: number; active?: boolean }) {
  return (
    <button onClick={onClick} aria-label={label} title={label} className={cn('relative grid h-11 w-11 shrink-0 place-items-center rounded-full transition active:scale-95 md:h-14 md:w-14', active ? 'bg-brand-500' : on ? 'bg-white/15 hover:bg-white/25' : 'bg-white text-navy-900')}>
      <I className="h-5 w-5 md:h-6 md:w-6" />
      {badge ? <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-brand-500 px-1 text-[10px] font-bold">{badge}</span> : null}
    </button>
  );
}
