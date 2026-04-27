import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, Inbox, MessageCircle, Plus, Search, Send, User } from 'lucide-react';
import { Conversation, Message, Patient } from '../types';
import { api } from '../services/api';
import { auth } from '../services/auth';
import { supabase } from '../services/supabase';

interface MessagingViewProps {
  patients: Patient[];
  messagingEnabled: boolean;
}

type SidebarMode = 'chats' | 'new';

const formatTime = (timestamp?: string) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatConversationTime = (timestamp?: string) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return formatTime(timestamp);
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString();
};

const normalizeSearchText = (value?: string | number | null) => String(value || '').toLowerCase().trim();
const normalizePhoneSearchText = (value?: string | null) => (value || '').replace(/\D/g, '');

const matchesSearch = (values: Array<string | number | null | undefined>, rawQuery: string) => {
  const query = normalizeSearchText(rawQuery);
  const phoneQuery = normalizePhoneSearchText(rawQuery);
  if (!query) return true;

  return values.some((value) => {
    const text = normalizeSearchText(value);
    const phoneText = normalizePhoneSearchText(typeof value === 'string' ? value : String(value || ''));
    return text.includes(query) || (!!phoneQuery && phoneText.includes(phoneQuery));
  });
};

const getPatientContactLine = (patient?: Patient) => {
  if (!patient) return '';
  return [patient.username, patient.phone, patient.email].filter(Boolean).join(' / ');
};

const getInitials = (value?: string) => {
  const parts = (value || 'Patient').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'P';
};

const MessagingView: React.FC<MessagingViewProps> = ({ patients, messagingEnabled }) => {
  const staffSession = auth.getCurrentUser();
  const adminId = staffSession && staffSession.role !== 'patient' ? staffSession.userId : undefined;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [startingConversation, setStartingConversation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConversationIdRef = useRef<string | null>(null);

  selectedConversationIdRef.current = selectedConversationId;

  const patientsById = useMemo(() => {
    return patients.reduce<Record<string, Patient>>((acc, patient) => {
      if (patient?.id) {
        acc[patient.id] = patient;
      }
      return acc;
    }, {});
  }, [patients]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const selectedPatient = selectedConversation?.patient_id
    ? patientsById[selectedConversation.patient_id]
    : undefined;

  const filteredConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      const patient = conversation.patient_id ? patientsById[conversation.patient_id] : undefined;
      return matchesSearch([
        conversation.participant_name,
        conversation.patient_name,
        patient?.name,
        patient?.username,
        patient?.phone,
        patient?.email
      ], searchQuery);
    });
  }, [conversations, patientsById, searchQuery]);

  const availablePatients = useMemo(() => {
    const existingPatientIds = new Set(conversations.map((conversation) => conversation.patient_id).filter(Boolean));
    return patients
      .filter((patient) => patient?.id && patient?.name)
      .filter((patient) => !existingPatientIds.has(patient.id))
      .filter((patient) => matchesSearch([patient.name, patient.username, patient.phone, patient.email], searchQuery))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [conversations, patients, searchQuery]);

  const unreadTotal = useMemo(
    () => conversations.reduce((total, conversation) => total + (conversation.unread_count || 0), 0),
    [conversations]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async (showLoading = false) => {
    if (!adminId) {
      setConversations([]);
      setSelectedConversationId(null);
      setLoading(false);
      setError('Invalid admin session. Please log in again.');
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }

      const nextConversations = await api.messages.getConversations(adminId, 'admin');
      const patientConversations = nextConversations.filter((conversation) => (conversation.participant_type || 'patient') !== 'doctor');
      setConversations(patientConversations);

      setSelectedConversationId((currentId) => {
        if (patientConversations.length === 0) {
          return null;
        }

        if (currentId && patientConversations.some((conversation) => conversation.id === currentId)) {
          return currentId;
        }

        return patientConversations[0].id;
      });
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const loadMessages = async (conversationId: string, showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }

      const nextMessages = await api.messages.getMessages(conversationId);
      setMessages(nextMessages);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load messages.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const markConversationAsRead = async (conversationId: string) => {
    if (!adminId) return;

    try {
      await api.messages.markAsRead(conversationId, adminId, 'admin');
      const refreshedConversations = await api.messages.getConversations(adminId, 'admin');
      setConversations(refreshedConversations.filter((conversation) => (conversation.participant_type || 'patient') !== 'doctor'));
    } catch (err) {
      console.error('Failed to mark messages as read:', err);
    }
  };

  useEffect(() => {
    if (!messagingEnabled) {
      setLoading(false);
      setError('Messaging is disabled right now.');
      return;
    }

    if (!adminId) {
      setLoading(false);
      setError('Invalid admin session. Please log in again.');
      return;
    }

    loadConversations(true);
  }, [adminId, messagingEnabled]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    loadMessages(selectedConversationId, true);
    markConversationAsRead(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!messagingEnabled || !adminId) {
      return;
    }

    const refreshConversationList = () => {
      loadConversations(false);
    };

    const refreshCurrentMessages = (conversationId?: string) => {
      const activeConversationId = selectedConversationIdRef.current;
      if (!activeConversationId || conversationId !== activeConversationId) {
        return;
      }

      loadMessages(activeConversationId, false);
      markConversationAsRead(activeConversationId);
    };

    const conversationsChannel = supabase
      .channel(`admin-conversations-${adminId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `admin_id=eq.${adminId}`
      }, () => {
        refreshConversationList();
      })
      .subscribe();

    const inboundMessagesChannel = supabase
      .channel(`admin-messages-in-${adminId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${adminId}`
      }, (payload) => {
        const conversationId = (payload.new as any)?.conversation_id || (payload.old as any)?.conversation_id;
        refreshConversationList();
        refreshCurrentMessages(conversationId);
      })
      .subscribe();

    const outboundMessagesChannel = supabase
      .channel(`admin-messages-out-${adminId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${adminId}`
      }, (payload) => {
        const conversationId = (payload.new as any)?.conversation_id || (payload.old as any)?.conversation_id;
        refreshConversationList();
        refreshCurrentMessages(conversationId);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(conversationsChannel);
      supabase.removeChannel(inboundMessagesChannel);
      supabase.removeChannel(outboundMessagesChannel);
    };
  }, [adminId, messagingEnabled]);

  const handleSendMessage = async () => {
    if (!adminId || !selectedConversation || !newMessage.trim() || sending) {
      return;
    }

    try {
      setSending(true);
      const content = newMessage.trim();
      let notificationErrorMessage: string | null = null;
      const sentMessage = await api.messages.createMessage({
        conversation_id: selectedConversation.id,
        sender_id: adminId,
        sender_type: 'admin',
        recipient_id: selectedConversation.patient_id || '',
        recipient_type: 'patient',
        content
      });

      try {
        await api.messages.sendAdminReplyNotification({
          message: sentMessage,
          patientName: selectedConversation.patient_name,
          adminName: selectedConversation.admin_name
        });
      } catch (notificationError) {
        console.warn('Message notification email failed:', notificationError);
        notificationErrorMessage = notificationError instanceof Error
          ? notificationError.message
          : 'The message was saved, but the email notification failed.';
      }

      setNewMessage('');
      await loadMessages(selectedConversation.id, false);
      await loadConversations(false);
      setError(notificationErrorMessage);
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleOpenConversation = async (patientId: string) => {
    if (!adminId || startingConversation) {
      return;
    }

    const existingConversation = conversations.find((conversation) => conversation.patient_id === patientId);
    if (existingConversation) {
      setSelectedConversationId(existingConversation.id);
      setSidebarMode('chats');
      return;
    }

    try {
      setStartingConversation(patientId);
      const conversation = await api.messages.createConversation(patientId, adminId, 'patient');
      await loadConversations(false);
      setSelectedConversationId(conversation.id);
      setSidebarMode('chats');
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to start conversation.');
    } finally {
      setStartingConversation(null);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (!messagingEnabled) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center bg-white px-6 text-center">
        <div className="max-w-sm">
          <MessageCircle className="mx-auto h-10 w-10 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Messaging disabled</h2>
          <p className="mt-2 text-sm text-gray-500">Turn the feature back on to chat with patients in real time.</p>
        </div>
      </div>
    );
  }

  const sidebarItems = sidebarMode === 'chats' ? filteredConversations : availablePatients;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-6 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
          <p className="mt-1 text-sm text-gray-500">Patient conversations and new chat requests in one inbox.</p>
        </div>
        <div className="hidden items-center gap-2 text-sm text-gray-500 sm:flex">
          <Inbox className="h-4 w-4" />
          <span>{conversations.length} chats</span>
          {unreadTotal > 0 && <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700">{unreadTotal} unread</span>}
        </div>
      </div>

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-gray-200 bg-white">
          <div className="space-y-3 border-b border-gray-200 px-4 py-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search name, username, phone, or email"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <div className="grid grid-cols-2 rounded-lg bg-gray-100 p-1">
              <button
                type="button"
                onClick={() => setSidebarMode('chats')}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  sidebarMode === 'chats' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Conversations
              </button>
              <button
                type="button"
                onClick={() => setSidebarMode('new')}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  sidebarMode === 'new' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Start Chat
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {sidebarItems.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <MessageCircle className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-700">
                  {searchQuery ? 'No results found' : sidebarMode === 'chats' ? 'No conversations yet' : 'No patients available'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {sidebarMode === 'chats' ? 'Switch to Start Chat to message a patient.' : 'Every patient already has a chat with this admin.'}
                </p>
              </div>
            ) : sidebarMode === 'chats' ? (
              filteredConversations.map((conversation) => {
                const patient = conversation.patient_id ? patientsById[conversation.patient_id] : undefined;
                const displayName = conversation.participant_name || conversation.patient_name || patient?.name || 'Patient';
                const contactLine = getPatientContactLine(patient);

                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors ${
                      selectedConversationId === conversation.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      selectedConversationId === conversation.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getInitials(displayName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-gray-900">{displayName}</p>
                        <span className="flex-shrink-0 text-[11px] text-gray-400">
                          {formatConversationTime(conversation.last_message_time || conversation.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{contactLine || 'Patient'}</p>
                      <p className="mt-1 truncate text-xs text-gray-500">{conversation.last_message || 'No messages yet'}</p>
                    </div>
                    {conversation.unread_count > 0 && (
                      <span className="mt-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-indigo-600 px-1.5 text-[11px] font-semibold text-white">
                        {conversation.unread_count}
                      </span>
                    )}
                  </button>
                );
              })
            ) : (
              availablePatients.map((patient) => (
                <button
                  key={`patient-${patient.id}`}
                  type="button"
                  onClick={() => handleOpenConversation(patient.id)}
                  disabled={startingConversation === patient.id}
                  className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-semibold text-gray-600">
                    {getInitials(patient.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{patient.name}</p>
                    <p className="mt-0.5 truncate text-xs text-gray-500">{getPatientContactLine(patient) || 'No contact details'}</p>
                  </div>
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                    {startingConversation === patient.id ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-indigo-600" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col bg-slate-50">
          {selectedConversation ? (
            <>
              <div className="border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                    {getInitials(selectedConversation.participant_name || selectedConversation.patient_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {selectedConversation.participant_name || selectedConversation.patient_name}
                    </div>
                    <div className="truncate text-xs text-gray-500">{getPatientContactLine(selectedPatient) || 'Live patient chat'}</div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <MessageCircle className="mx-auto h-10 w-10 text-gray-300" />
                      <p className="mt-3 text-sm font-medium text-gray-700">No messages yet</p>
                      <p className="mt-1 text-xs text-gray-500">Send the first message to begin the conversation.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => {
                    const isAdmin = message.sender_type === 'admin';
                    return (
                      <div key={message.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-xl rounded-2xl px-4 py-3 text-sm shadow-sm ${
                            isAdmin
                              ? 'rounded-br-md bg-indigo-600 text-white'
                              : 'rounded-bl-md border border-gray-200 bg-white text-gray-900'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <div className={`mt-2 flex items-center gap-1 text-[11px] ${isAdmin ? 'justify-end text-indigo-100' : 'text-gray-500'}`}>
                            <span>{formatTime(message.timestamp)}</span>
                            {isAdmin && (message.read ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />)}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-200 bg-white px-6 py-4">
                <div className="flex items-end gap-3">
                  <textarea
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    rows={2}
                    placeholder="Write a message..."
                    className="min-h-[52px] flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6 text-center">
              <div className="max-w-sm">
                <User className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-lg font-semibold text-gray-900">Select a patient conversation</p>
                <p className="mt-2 text-sm text-gray-500">Choose an existing chat or start a new one from the inbox sidebar.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MessagingView;
