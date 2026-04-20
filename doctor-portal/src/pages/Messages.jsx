import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  Circle,
  Clock3,
  Handshake,
  IndianRupee,
  Loader2,
  MessageCircleMore,
  MessageSquare,
  PhoneCall,
  Plus,
  Send,
  UserRound,
  Video,
  Trash2,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import { doctorChatService, doctorService } from '../services/api';
import { createDoctorPortalChatSocket } from '../features/chat/socketService';
import {
  Lock,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const normalizeStatus = (status) => {
  if (!status) return 'pending';
  const s = status.toLowerCase();
  if (s === 'confirmed' || s === 'scheduled') return 'confirmed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return s;
};

const parseTimingsString = (str) => {
  if (!str || !str.includes(' to ')) return { minTime: '10:00', maxTime: '18:00' };
  try {
    const [startPart, endPart] = str.split(' to ');
    const parse = (timeStr) => {
      const match = timeStr.match(/(\d+):(\d+)\s*(am|pm)/i);
      if (!match) return '10:00';
      let [_, h, m, p] = match;
      h = parseInt(h);
      if (p.toLowerCase() === 'pm' && h < 12) h += 12;
      if (p.toLowerCase() === 'am' && h === 12) h = 0;
      return `${h.toString().padStart(2, '0')}:${m}`;
    };
    return { minTime: parse(startPart), maxTime: parse(endPart) };
  } catch (e) {
    return { minTime: '10:00', maxTime: '18:00' };
  }
};


const MODE_OPTIONS = ['VIDEO', 'AUDIO', 'CHAT'];

const MODE_META = {
  VIDEO: { label: 'Video Call', icon: Video },
  AUDIO: { label: 'Audio Call', icon: PhoneCall },
  CHAT: { label: 'Chat', icon: MessageCircleMore },
};

const createOfferDraft = () => ({
  date: new Date().toISOString().split('T')[0],
  time: '',
  amount: '',
  mode: 'VIDEO',
  duration: 30,
});

const upsertMessageList = (messages, nextMessage) => {
  if (!nextMessage?._id) return messages;
  const existingIndex = messages.findIndex((item) => item._id === nextMessage._id);
  if (existingIndex === -1) {
    return [...messages, nextMessage].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  const nextMessages = [...messages];
  nextMessages[existingIndex] = { ...nextMessages[existingIndex], ...nextMessage };
  return nextMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const updateNegotiationInMessages = (messages, negotiation) => messages.map((message) => (
  String(message.negotiationId || message.negotiation?._id || '') === String(negotiation?._id || '')
    ? { ...message, negotiationId: negotiation._id, negotiation }
    : message
));

const formatMoney = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(amount || 0);

const formatOfferDate = (value) => new Date(value).toLocaleDateString('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const NegotiationCard = ({ message, currentRole, onAccept, onCounter, acceptingId }) => {
  const negotiation = message.negotiation;
  const modeMeta = MODE_META[negotiation?.mode] || MODE_META.CHAT;
  const ModeIcon = modeMeta.icon;
  const didAccept = currentRole === 'DOCTOR' ? negotiation?.acceptedByDoctor : negotiation?.acceptedByUser;
  const otherAccepted = currentRole === 'DOCTOR' ? negotiation?.acceptedByUser : negotiation?.acceptedByDoctor;
  const isLocked = negotiation?.status === 'LOCKED';
  const isPending = negotiation?.status === 'PENDING';
  const isAccepting = acceptingId === negotiation?._id;

  return (
    <div className="w-full max-w-[420px] rounded-[28px] border border-primary-200/90 bg-gradient-to-br from-white via-primary-50/60 to-emerald-50/60 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.24em] text-primary-700">
            <Handshake size={14} />
            <span>Consultation Offer</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-600">
            {message.senderRole === currentRole ? 'You proposed consultation terms.' : 'Patient proposed consultation terms.'}
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] ${
          isLocked ? 'bg-primary-600 text-white' : 'bg-amber-100 text-amber-700'
        }`}>
          {negotiation?.status || 'PENDING'}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm text-slate-700">
        <div className="rounded-2xl bg-white/85 px-4 py-3 border border-white">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><CalendarDays size={14} /> Date</div>
          <div className="mt-2 font-bold text-slate-900">{formatOfferDate(negotiation?.date)}</div>
        </div>
        <div className="rounded-2xl bg-white/85 px-4 py-3 border border-white">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><Clock3 size={14} /> Time</div>
          <div className="mt-2 font-bold text-slate-900">{negotiation?.time}</div>
        </div>
        <div className="rounded-2xl bg-white/85 px-4 py-3 border border-white">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><IndianRupee size={14} /> Amount</div>
          <div className="mt-2 font-bold text-slate-900">{formatMoney(negotiation?.amount)}</div>
        </div>
        <div className="rounded-2xl bg-white/85 px-4 py-3 border border-white">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><ModeIcon size={14} /> Mode</div>
          <div className="mt-2 font-bold text-slate-900">{modeMeta.label}</div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-primary-100 bg-white/80 px-4 py-3 text-sm">
        {isLocked ? (
          <div className="font-bold text-primary-700">Deal confirmed. The consultation terms are locked.</div>
        ) : didAccept ? (
          <div className="font-semibold text-slate-600">Waiting for the other party to accept this deal.</div>
        ) : otherAccepted ? (
          <div className="font-semibold text-primary-700">The other party has accepted the deal! Do you want to accept or counter?</div>
        ) : (
          <div className="font-semibold text-slate-600">Accept this deal to lock the schedule and consultation terms.</div>
        )}
      </div>

      <div className="mt-4">
        {isLocked ? (
          <div className="rounded-2xl bg-primary-600 px-4 py-3 text-center text-sm font-bold text-white">
            Deal Confirmed
          </div>
        ) : isPending && !didAccept ? (
          <div className="flex gap-2">
            <button
              onClick={() => onAccept(negotiation?._id)}
              disabled={isAccepting}
              className="flex-1 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-700 disabled:bg-slate-300"
            >
              {isAccepting ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={() => onCounter(negotiation)}
              disabled={isAccepting}
              className="flex-1 rounded-2xl bg-white border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:bg-slate-100"
            >
              Counter
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-600">
            {negotiation?.status === 'COUNTERED' ? 'This deal was countered.' : 'Waiting for other party...'}
          </div>
        )}
      </div>
    </div>
  );
};

const Messages = () => {
  const { chatId: routeChatId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const offerPanelRef = useRef(null);

  const [chats, setChats] = useState([]);
  const [messagesByChat, setMessagesByChat] = useState({});
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [isUserTyping, setIsUserTyping] = useState(false);
  const [isOfferOpen, setIsOfferOpen] = useState(false);
  const [offerDraft, setOfferDraft] = useState(createOfferDraft());
  const [offerSending, setOfferSending] = useState(false);
  const [acceptingNegotiationId, setAcceptingNegotiationId] = useState('');
  const [counteringNegotiationId, setCounteringNegotiationId] = useState('');
  const [doctorData, setDoctorData] = useState(null);
  const [appointments, setAppointments] = useState([]);

  const activeChatId = routeChatId || chats[0]?._id || null;
  const activeChat = useMemo(() => chats.find((chat) => chat._id === activeChatId) || null, [chats, activeChatId]);
  const activeMessages = messagesByChat[activeChatId] || [];

  const loadChats = async (preferredChatId = null) => {
    setLoadingChats(true);
    try {
      const nextChats = await doctorChatService.listChats();
      setChats(nextChats);
      const targetId = preferredChatId || routeChatId || nextChats[0]?._id;
      if (targetId && targetId !== routeChatId) {
        navigate(`/messages/${targetId}`, { replace: true });
      }
    } catch (error) {
      console.error('Failed to load doctor chats:', error);
    } finally {
      setLoadingChats(false);
    }
  };

  const fetchDoctorData = async () => {
    try {
      const [profile, apts] = await Promise.all([
        doctorService.getProfile(),
        doctorService.getAppointments()
      ]);
      setDoctorData(profile);
      setAppointments(apts);
    } catch (err) {
      console.error('Failed to load availability data for negotiation', err);
    }
  };

  useEffect(() => {
    loadChats();
    fetchDoctorData();
  }, []);

  useEffect(() => {
    const userId = searchParams.get('userId');
    if (!userId) return;

    const run = async () => {
      try {
        const chat = await doctorChatService.initiateChat({ userId });
        await loadChats(chat?._id);
        if (chat?._id) {
          navigate(`/messages/${chat._id}`, { replace: true });
        }
      } catch (error) {
        console.error('Failed to initiate patient chat:', error);
      }
    };

    run();
  }, [searchParams]);

  useEffect(() => {
    if (!activeChatId) return;

    const loadMessages = async () => {
      setLoadingMessages(true);
      try {
        const nextMessages = await doctorChatService.getMessages(activeChatId);
        setMessagesByChat((prev) => ({ ...prev, [activeChatId]: nextMessages }));
        await doctorChatService.markRead(activeChatId);
        setChats((prev) => prev.map((chat) => (
          chat._id === activeChatId ? { ...chat, unreadCount: 0 } : chat
        )));
      } catch (error) {
        console.error('Failed to load patient messages:', error);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
    setIsOfferOpen(false);
    setOfferDraft(createOfferDraft());
  }, [activeChatId]);

  useEffect(() => {
    if (!token) return;
    const socket = createDoctorPortalChatSocket(token);
    socketRef.current = socket;

    socket.on('chat:updated', async () => {
      try {
        const nextChats = await doctorChatService.listChats();
        setChats(nextChats);
      } catch (error) {
        console.error('Failed to sync charts dynamically', error);
      }
    });

    socket.on('chat:deleted', ({ chatId }) => {
       setChats((prev) => prev.filter((chat) => chat._id !== chatId));
       if (activeChatId === chatId) {
         navigate('/messages', { replace: true });
       }
    });

    socket.on('message:new', (message) => {
      setMessagesByChat((prev) => ({
        ...prev,
        [message.chatId]: upsertMessageList(prev[message.chatId] || [], message),
      }));

      setChats((prev) => prev.map((chat) => {
        if (chat._id !== message.chatId) return chat;
        const shouldIncrement = message.senderRole === 'USER' && message.chatId !== activeChatId;
        return {
          ...chat,
          lastMessage: message.message,
          unreadCount: shouldIncrement ? (chat.unreadCount || 0) + 1 : 0,
          updatedAt: message.timestamp,
        };
      }));
    });

    socket.on('message:read', ({ chatId }) => {
      setChats((prev) => prev.map((chat) => (
        chat._id === chatId ? { ...chat, unreadCount: 0 } : chat
      )));
    });

    socket.on('presence:update', ({ userId, isOnline }) => {
      setChats((prev) => prev.map((chat) => (
        chat.participantUserId === userId ? { ...chat, participantIsOnline: isOnline } : chat
      )));
    });

    socket.on('typing:update', ({ chatId, senderRole, isTyping }) => {
      if (chatId === activeChatId && senderRole === 'USER') {
        setIsUserTyping(!!isTyping);
      }
    });

    socket.on('negotiation:update', (negotiation) => {
      setMessagesByChat((prev) => ({
        ...prev,
        [negotiation.chatId]: updateNegotiationInMessages(prev[negotiation.chatId] || [], negotiation),
      }));
    });

    return () => socket.disconnect();
  }, [token, activeChatId]);

  useEffect(() => {
    if (!activeChatId || !socketRef.current) return;
    socketRef.current.emit('chat:join', { chatId: activeChatId });
  }, [activeChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages, isUserTyping, loadingMessages]);

  useEffect(() => {
    if (!isOfferOpen) return undefined;

    const handlePointerDown = (event) => {
      if (offerPanelRef.current && !offerPanelRef.current.contains(event.target)) {
        setIsOfferOpen(false);
        setOfferDraft(createOfferDraft());
        setCounteringNegotiationId('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOfferOpen]);

  const handleTyping = (value) => {
    setInput(value);
    if (socketRef.current && activeChatId) {
      socketRef.current.emit('typing:update', { chatId: activeChatId, isTyping: value.trim().length > 0 });
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeChatId || sending) return;

    setSending(true);
    setInput('');
    try {
      const message = await doctorChatService.sendMessage({ chatId: activeChatId, message: text });
      setMessagesByChat((prev) => ({
        ...prev,
        [activeChatId]: upsertMessageList(prev[activeChatId] || [], message),
      }));
      setChats((prev) => prev.map((chat) => (
        chat._id === activeChatId
          ? { ...chat, lastMessage: text, unreadCount: 0, updatedAt: message.timestamp }
          : chat
      )));
      socketRef.current?.emit('typing:update', { chatId: activeChatId, isTyping: false });
    } catch (error) {
      console.error('Failed to send doctor message:', error);
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleCreateNegotiation = async () => {
    if (!activeChatId || offerSending) return;

    const amount = Number(offerDraft.amount);
    if (!offerDraft.date || !offerDraft.time || !Number.isFinite(amount) || amount < 0) {
      window.alert('Please fill date, time, and a valid amount before sending the offer.');
      return;
    }

    setOfferSending(true);
    try {
      let message;
      if (counteringNegotiationId) {
        const res = await doctorChatService.counterNegotiation({
          negotiationId: counteringNegotiationId,
          date: offerDraft.date,
          time: offerDraft.time,
          amount,
          mode: offerDraft.mode,
        });
        message = res.newMessage;
        setMessagesByChat((prev) => ({
          ...prev,
          [activeChatId]: updateNegotiationInMessages(prev[activeChatId] || [], res.oldNegotiation),
        }));
      } else {
        message = await doctorChatService.createNegotiation({
          chatId: activeChatId,
          date: offerDraft.date,
          time: offerDraft.time,
          amount,
          mode: offerDraft.mode,
        });
      }
      setMessagesByChat((prev) => ({
        ...prev,
        [activeChatId]: upsertMessageList(prev[activeChatId] || [], message),
      }));
      setChats((prev) => prev.map((chat) => (
        chat._id === activeChatId
          ? { ...chat, lastMessage: message.message, updatedAt: message.timestamp, unreadCount: 0 }
          : chat
      )));
      setIsOfferOpen(false);
      setOfferDraft(createOfferDraft());
      setCounteringNegotiationId('');
    } catch (error) {
      console.error('Failed to create/counter negotiation:', error);
      window.alert(error?.message || 'Unable to create consultation offer right now.');
    } finally {
      setOfferSending(false);
    }
  };

  const handleCounter = (negotiation) => {
    setCounteringNegotiationId(negotiation._id);
    const d = new Date(negotiation.date);
    const dateStr = d.toISOString().split('T')[0];
    setOfferDraft({
      date: dateStr,
      time: negotiation.time,
      amount: negotiation.amount,
      mode: negotiation.mode,
    });
    setIsOfferOpen(true);
  };

  const handleAcceptNegotiation = async (negotiationId) => {
    if (!negotiationId || acceptingNegotiationId) return;

    setAcceptingNegotiationId(negotiationId);
    try {
      const nextNegotiation = await doctorChatService.acceptNegotiation(negotiationId);
      setMessagesByChat((prev) => ({
        ...prev,
        [nextNegotiation.chatId]: updateNegotiationInMessages(prev[nextNegotiation.chatId] || [], nextNegotiation),
      }));
    } catch (error) {
      console.error('Failed to accept negotiation:', error);
      window.alert(error?.message || 'Unable to accept this deal right now.');
    } finally {
      setAcceptingNegotiationId('');
    }
  };

  const availableDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 14; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        days.push(d);
    }
    return days;
  }, []);

  const timeSlots = useMemo(() => {
    if (!doctorData?.availability?.timings || !offerDraft.date) return [];
    const { minTime, maxTime } = parseTimingsString(doctorData.availability.timings);
    const [startH, startM] = minTime.split(':').map(Number);
    const [endH, endM] = maxTime.split(':').map(Number);
    
    const slots = [];
    const baseDate = offerDraft.date; 
    let curr = new Date(`${baseDate}T00:00:00`);
    curr.setHours(startH, startM, 0, 0);
    const end = new Date(`${baseDate}T00:00:00`);
    end.setHours(endH, endM, 0, 0);
    
    const requestedDuration = Number(offerDraft.duration) || 30;
    const now = new Date();
    let foundRecommended = false;

    while (curr < end) {
      const timeStr = curr.toTimeString().slice(0, 5);
      const sStart = new Date(curr.getTime());
      const sEnd = new Date(sStart.getTime() + requestedDuration * 60 * 1000);

      const isBooked = appointments.some(apt => {
        const status = normalizeStatus(apt.status);
        if (status !== 'confirmed' && status !== 'scheduled') return false;
        const aStart = new Date(apt.startTime);
        let aEnd = apt.endTime ? new Date(apt.endTime) : new Date(aStart.getTime() + (apt.duration || 30) * 60 * 1000);
        return (sStart < aEnd && sEnd > aStart);
      });
      
      let isRecommended = false;
      const isPast = sStart < new Date(now.getTime() + 15 * 60 * 1000);
      const isToday = baseDate === new Date().toISOString().split('T')[0];
      if (!isBooked && !foundRecommended) {
        if (!isToday || !isPast) {
          isRecommended = true;
          foundRecommended = true;
        }
      }

      slots.push({
        time: timeStr,
        label: curr.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isBooked,
        isRecommended: isRecommended && !isBooked
      });
      curr = new Date(curr.getTime() + 15 * 60 * 1000); 
    }
    return slots;
  }, [doctorData, offerDraft.date, offerDraft.duration, appointments]);

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex">
      <Sidebar />
      <main className="flex-1 ml-72 h-screen overflow-hidden">
        <div className="h-full min-h-0 grid grid-cols-[320px_1fr]">
          <aside className="bg-white border-r border-slate-200 h-full overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <MessageSquare size={22} />
                </div>
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">Patient Chats</h1>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">Live consultations</p>
                </div>
              </div>
            </div>

            <div className="p-3 space-y-2">
              {loadingChats ? (
                <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
              ) : chats.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">Patient chats will appear here once a consultation relationship exists.</div>
              ) : chats.map((chat) => (
                <div
                  key={chat._id}
                  className={`group flex items-center w-full text-left rounded-2xl border transition-all ${
                    chat._id === activeChatId
                      ? 'bg-[#82a18d] text-white border-[#82a18d] shadow-md shadow-[#82a18d]/20'
                      : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300'
                  }`}
                >
                <button
                  onClick={() => navigate(`/messages/${chat._id}`)}
                  className="flex-1 w-full text-left p-4 min-w-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{chat.participantName}</div>
                      <div className={`text-xs truncate mt-1 ${chat._id === activeChatId ? 'text-white/80' : 'text-slate-500'}`}>
                        {chat.lastMessage || 'No messages yet'}
                      </div>
                    </div>
                    {chat.unreadCount > 0 && (
                      <span className="min-w-6 h-6 px-2 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">
                        {chat.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
                <button
                   onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm('Are you sure you want to delete this chat completely?')) {
                         try {
                            await doctorChatService.deleteChat(chat._id);
                            setChats(prev => prev.filter(c => c._id !== chat._id));
                            if (activeChatId === chat._id) navigate('/messages', { replace: true });
                         } catch (err) {
                            window.alert('Failed to delete chat');
                         }
                      }
                   }}
                   className={`p-4 transition-colors opacity-0 group-hover:opacity-100 ${chat._id === activeChatId ? 'text-white/70 hover:text-red-300' : 'text-slate-400 hover:text-red-500'}`}
                >
                   <Trash2 size={16} />
                </button>
                </div>
              ))}
            </div>
          </aside>

          <section className="h-full min-h-0 flex flex-col overflow-hidden">
            {activeChat ? (
              <>
                <div className="sticky top-0 z-20 flex-shrink-0 px-8 py-5 bg-white/95 backdrop-blur border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                      <UserRound size={20} />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-900">{activeChat.participantName}</div>
                      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Circle size={10} fill={activeChat.participantIsOnline ? '#10b981' : '#cbd5e1'} strokeWidth={0} />
                        <span>{activeChat.participantIsOnline ? 'Online' : 'Offline'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-8 py-6 space-y-4">
                  {loadingMessages ? (
                    <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-slate-400" /></div>
                  ) : activeMessages.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm">Open the consultation with a quick update or greeting.</div>
                  ) : activeMessages.map((message) => {
                    const isOwn = message.senderRole === 'DOCTOR';
                    return (
                      <div key={message._id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        {message.type === 'NEGOTIATION' && message.negotiation ? (
                          <NegotiationCard
                            message={message}
                            currentRole="DOCTOR"
                            onAccept={handleAcceptNegotiation}                          onCounter={handleCounter}                            acceptingId={acceptingNegotiationId}
                          />
                        ) : (
                          <div className={`max-w-[70%] px-5 py-3 rounded-3xl ${
                            isOwn ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-900 rounded-bl-md'
                          }`}>
                            <div className="text-sm leading-6">{message.message}</div>
                            <div className={`text-[11px] mt-2 ${isOwn ? 'text-primary-100' : 'text-slate-400'}`}>
                              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {isUserTyping && <div className="text-xs font-semibold text-slate-400">Patient is typing...</div>}
                  <div ref={bottomRef} />
                </div>

                <div className="relative flex-shrink-0 p-6 border-t border-slate-200 bg-white">
                  {isOfferOpen && (
                    <div ref={offerPanelRef} className="absolute bottom-[calc(100%+12px)] left-6 w-[440px] rounded-[2.5rem] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-300/40 flex flex-col gap-6 max-h-[600px] overflow-y-auto">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center">
                            <Handshake size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900">Consultation Offer</div>
                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Define your terms</div>
                          </div>
                        </div>
                        <button onClick={() => setIsOfferOpen(false)} className="text-slate-300 hover:text-slate-500 transition-colors"><Trash2 size={16} /></button>
                      </div>

                      {/* Initial Timing Display (if countering) */}
                      {counteringNegotiationId && (
                         <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                           <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Patient's Preferred Slot</div>
                           <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                             <Clock3 size={14} className="text-primary-500" />
                             <span>{offerDraft.date} at {offerDraft.time}</span>
                           </div>
                         </div>
                      )}

                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Consultation Fee</label>
                            <div className="relative">
                              <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                              <input
                                type="number"
                                value={offerDraft.amount}
                                onChange={(e) => setOfferDraft((prev) => ({ ...prev, amount: e.target.value }))}
                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-primary-400 outline-none transition-all"
                                placeholder="Fee"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Duration (m)</label>
                            <select
                              value={offerDraft.duration}
                              onChange={(e) => setOfferDraft((prev) => ({ ...prev, duration: Number(e.target.value) }))}
                              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:border-primary-400 outline-none transition-all"
                            >
                              {[15, 30, 45, 60].map(d => <option key={d} value={d}>{d} mins</option>)}
                            </select>
                          </div>
                        </div>

                        {/* Date Carousel */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Date</label>
                          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none snap-x">
                            {availableDays.map((date, i) => {
                              const dateStr = date.toISOString().split('T')[0];
                              const isSelected = offerDraft.date === dateStr;
                              return (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => setOfferDraft({ ...offerDraft, date: dateStr })}
                                  className={`flex-shrink-0 w-16 h-16 rounded-2xl border transition-all flex flex-col items-center justify-center gap-0.5 snap-start ${
                                    isSelected ? 'bg-primary-600 border-primary-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500 hover:border-primary-200'
                                  }`}
                                >
                                  <span className="text-[8px] font-black uppercase">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                                  <span className="text-sm font-black">{date.getDate()}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Time Grid */}
                        <div className="space-y-2">
                           <div className="flex items-center justify-between">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Select Available Time</label>
                              {doctorData?.availability?.timings && (
                                <span className="text-[8px] font-black text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded-md">{doctorData.availability.timings}</span>
                              )}
                           </div>
                           <div className="grid grid-cols-4 gap-2">
                              {timeSlots.map((slot, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  disabled={slot.isBooked}
                                  onClick={() => setOfferDraft({ ...offerDraft, time: slot.time })}
                                  className={`relative py-3 rounded-xl text-[10px] font-black transition-all flex flex-col items-center gap-1 ${
                                    slot.isBooked ? 'bg-slate-50 text-slate-200 border-slate-100 cursor-not-allowed' :
                                    offerDraft.time === slot.time ? 'bg-primary-600 text-white shadow-lg border-primary-600' :
                                    'bg-white border-slate-200 text-slate-600 hover:border-primary-400'
                                  } ${slot.isRecommended && !slot.isBooked && offerDraft.time !== slot.time ? 'ring-2 ring-emerald-400 ring-offset-1' : ''}`}
                                >
                                  {slot.isRecommended && !slot.isBooked && offerDraft.time !== slot.time && (
                                     <div className="absolute -top-1.5 -right-1 bg-emerald-500 text-white text-[6px] px-1 py-0.5 rounded-full">BEST</div>
                                  )}
                                  <span>{slot.label}</span>
                                  {slot.isBooked && <Lock size={10} />}
                                </button>
                              ))}
                           </div>
                        </div>

                        {/* Mode Selection */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Consultation Mode</label>
                          <div className="grid grid-cols-3 gap-2">
                            {MODE_OPTIONS.map((mode) => {
                              const meta = MODE_META[mode];
                              const Icon = meta.icon;
                              const isActive = offerDraft.mode === mode;
                              return (
                                <button
                                  key={mode}
                                  onClick={() => setOfferDraft({ ...offerDraft, mode })}
                                  className={`py-3 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all space-y-1.5 ${
                                    isActive ? 'bg-primary-50 border-primary-500 text-primary-700' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                  }`}
                                >
                                  <Icon size={14} className="mx-auto" />
                                  <span>{meta.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={handleCreateNegotiation}
                          disabled={offerSending || !offerDraft.time}
                          className="w-full py-4 rounded-[1.5rem] bg-primary-600 text-white text-xs font-black uppercase tracking-[0.2em] shadow-xl shadow-primary-600/20 hover:bg-primary-700 transition-all active:scale-95 disabled:bg-slate-100 disabled:text-slate-300 flex items-center justify-center gap-3"
                        >
                          {offerSending ? (
                            <Loader2 className="animate-spin" size={16} />
                          ) : (
                            <>FIX SELECTION & SEND OFFER <Check size={14} strokeWidth={3} /></>
                          )}
                        </button>
                        <p className="text-[8px] font-bold text-slate-400 text-center mt-3 uppercase tracking-widest leading-relaxed">
                          By clicking "FIX SELECTION", these clinical terms become non-negotiable for the current proposal branch.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsOfferOpen((prev) => !prev)}
                      className="h-14 w-14 rounded-2xl border border-slate-200 bg-white text-slate-700 flex items-center justify-center hover:border-primary-400 hover:text-primary-600 transition"
                    >
                      <Plus size={20} />
                    </button>
                    <textarea
                      value={input}
                      onChange={(e) => handleTyping(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={1}
                      placeholder="Reply to the patient..."
                      className="flex-1 resize-none rounded-3xl border border-slate-200 px-5 py-4 outline-none focus:border-primary-400"
                    />
                    <button
                      onClick={handleSend}
                      disabled={sending || !input.trim()}
                      className="h-14 w-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center disabled:bg-slate-300"
                    >
                      {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500">Select a patient chat to continue.</div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Messages;
