import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, MessageCircle, Send, User, ChevronLeft, Clock, Mail } from 'lucide-react';
import { Conversation, Message } from '../types';
import { api } from '../services/api';
import { auth } from '../services/auth';
import { supabase } from '../services/supabase';

interface PatientMessagingViewProps {
  currentUser: { userId?: string; id?: string; location_id?: string | null } | null;
  messagingEnabled: boolean;
}

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
    return `Today at ${formatTime(timestamp)}`;
  }

  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${formatTime(timestamp)}`;
  }

  return `${date.toLocaleDateString()} ${formatTime(timestamp)}`;
};

const PatientMessagingView: React.FC<PatientMessagingViewProps> = ({ currentUser, messagingEnabled }) => {
  const session = auth.getCurrentUser();
  const patientId = currentUser?.userId || currentUser?.id || session?.patientId || session?.userId;
  const patientLocationId = currentUser?.location_id || session?.location_id || null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConversationIdRef = useRef<string | null>(null);

  selectedConversationIdRef.current = selectedConversationId;

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async (showLoading = false) => {
    if (!patientId) {
      setConversations([]);
      setSelectedConversationId(null);
      setLoading(false);
      setError('Invalid patient session. Please log in again.');
      return;
    }

    try {
      if (showLoading) {
        setLoading(true);
      }

      const nextConversations = await api.messages.getConversations(patientId, 'patient');
      setConversations(nextConversations);
      setSelectedConversationId((currentId) => {
        if (nextConversations.length === 0) {
          return null;
        }

        if (currentId && nextConversations.some((conversation) => conversation.id === currentId)) {
          return currentId;
        }

        return nextConversations[0].id;
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
    if (!patientId) return;

    try {
      await api.messages.markAsRead(conversationId, patientId, 'patient');
      const refreshedConversations = await api.messages.getConversations(patientId, 'patient');
      setConversations(refreshedConversations);
    } catch (err) {
      console.error('Failed to mark patient messages as read:', err);
    }
  };

  useEffect(() => {
    if (!messagingEnabled) {
      setLoading(false);
      setError('Messaging is disabled right now.');
      return;
    }

    if (!patientId) {
      setLoading(false);
      setError('Invalid patient session. Please log in again.');
      return;
    }

    loadConversations(true);
  }, [messagingEnabled, patientId]);

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
    if (!messagingEnabled || !patientId) {
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
      .channel(`patient-conversations-${patientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `patient_id=eq.${patientId}`
      }, () => {
        refreshConversationList();
      })
      .subscribe();

    const inboundMessagesChannel = supabase
      .channel(`patient-messages-in-${patientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `recipient_id=eq.${patientId}`
      }, (payload) => {
        const conversationId = (payload.new as any)?.conversation_id || (payload.old as any)?.conversation_id;
        refreshConversationList();
        refreshCurrentMessages(conversationId);
      })
      .subscribe();

    const outboundMessagesChannel = supabase
      .channel(`patient-messages-out-${patientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `sender_id=eq.${patientId}`
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
  }, [messagingEnabled, patientId]);

  const handleSendMessage = async () => {
    if (!patientId || !selectedConversation || !newMessage.trim() || sending) {
      return;
    }

    try {
      setSending(true);
      await api.messages.createMessage({
        conversation_id: selectedConversation.id,
        sender_id: patientId,
        sender_type: 'patient',
        recipient_id: selectedConversation.admin_id,
        recipient_type: 'admin',
        content: newMessage.trim()
      });
      setNewMessage('');
      await loadMessages(selectedConversation.id, false);
      await loadConversations(false);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!patientId || creatingConversation) {
      return;
    }

    try {
      setCreatingConversation(true);

      let sameLocationAdmins: Array<{ id: string }> | null = null;

      if (patientLocationId) {
        const { data, error: sameLocationError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .eq('location_id', patientLocationId)
          .limit(1);

        if (sameLocationError) {
          throw new Error(sameLocationError.message);
        }

        sameLocationAdmins = data;
      }

      let adminId = sameLocationAdmins?.[0]?.id;

      if (!adminId) {
        const { data: fallbackAdmins, error: fallbackError } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'admin')
          .limit(1);

        if (fallbackError) {
          throw new Error(fallbackError.message);
        }

        adminId = fallbackAdmins?.[0]?.id;
      }

      if (!adminId) {
        throw new Error('No administrator is available for messaging right now.');
      }

      const conversation = await api.messages.createConversation(patientId, adminId);
      await loadConversations(false);
      setSelectedConversationId(conversation.id);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to start conversation.');
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  // ─── Loading State ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--hover-600)] border-t-transparent" />
          <span className="text-sm text-gray-400">Loading messages...</span>
        </div>
      </div>
    );
  }

  // ─── Disabled State ───────────────────────────────────────────────────────
  if (!messagingEnabled) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">
          <MessageCircle className="h-7 w-7 text-gray-300" />
        </div>
        <h3 className="text-base font-semibold text-gray-900">Messaging Disabled</h3>
        <p className="mt-1.5 text-sm text-gray-500">
          Clinic staff can turn this feature back on when needed.
        </p>
      </div>
    );
  }

  // ─── Main Render ──────────────────────────────────────────────────────────
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--hover-50)]">
            <Mail className="h-5 w-5 text-[var(--hover-600)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Messages</h2>
            <p className="mt-0.5 text-xs text-gray-400">Real-time chat with clinic staff</p>
          </div>
        </div>
      </div>

      {/* ── Error Banner ──────────────────────────────────────────────────── */}
      {error && (
        <div className="border-b border-red-100 bg-red-50/80 px-6 py-3 text-xs text-red-600">
          {error}
        </div>
      )}

      {/* ── Split Layout ──────────────────────────────────────────────────── */}
      <div className="flex h-[70vh] min-h-[520px] max-h-[720px] flex-col md:grid md:grid-cols-[300px_minmax(0,1fr)]">
        {/* ═══ Conversation List ═══════════════════════════════════════════════ */}
        <aside
          className={`${
            selectedConversation ? 'hidden md:block' : 'block'
          } border-r border-gray-100 bg-gray-50/50 md:flex md:min-h-0 md:flex-col`}
        >
          {/* Conversation header */}
          <div className="border-b border-gray-100 px-5 py-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Conversations
              {conversations.length > 0 && (
                <span className="ml-1.5 text-gray-300">({conversations.length})</span>
              )}
            </h3>
          </div>

          {/* Conversation items */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center px-6 py-12 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                  <MessageCircle className="h-6 w-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-700">No messages yet</p>
                <p className="mt-1 text-xs text-gray-400">
                  Start a conversation with the clinic.
                </p>
                <button
                  type="button"
                  onClick={handleCreateConversation}
                  disabled={creatingConversation}
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--hover-600)] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-[var(--hover-700)] hover:shadow-md active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <MessageCircle className="h-4 w-4" />
                  {creatingConversation ? 'Starting...' : 'Start Conversation'}
                </button>
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`group relative w-full border-b border-gray-100 px-5 py-4 text-left transition-all duration-200 ${
                    selectedConversationId === conversation.id
                      ? 'bg-white shadow-sm'
                      : 'bg-transparent hover:bg-white/80'
                  }`}
                >
                  {/* Active indicator */}
                  {selectedConversationId === conversation.id && (
                    <span className="absolute left-0 top-1/2 h-8 w-0.5 -translate-y-1/2 rounded-r-full bg-[var(--hover-600)]" />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                        selectedConversationId === conversation.id
                          ? 'bg-[var(--hover-50)]'
                          : 'bg-gray-100 group-hover:bg-gray-50'
                      } transition-colors duration-200`}
                    >
                      <User
                        className={`h-5 w-5 ${
                          selectedConversationId === conversation.id
                            ? 'text-[var(--hover-600)]'
                            : 'text-gray-400'
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-gray-900">
                          {conversation.admin_name || 'Administrator'}
                        </span>
                        {conversation.last_message_time && (
                          <span className="shrink-0 text-[11px] text-gray-400">
                            {formatConversationTime(conversation.last_message_time || conversation.created_at)}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {conversation.last_message || 'No messages yet'}
                      </p>
                    </div>

                    {/* Unread badge */}
                    {conversation.unread_count > 0 && (
                      <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[var(--hover-600)] px-1.5 text-[11px] font-bold text-white shadow-sm">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ═══ Chat Area ═══════════════════════════════════════════════════════ */}
        <section
          className={`${
            selectedConversation ? 'flex' : 'hidden md:flex'
          } min-h-0 flex-col bg-white`}
        >
          {selectedConversation ? (
            <>
              {/* ── Chat Header ────────────────────────────────────────────── */}
              <div className="border-b border-gray-100 px-5 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedConversationId(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 md:hidden"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--hover-50)]">
                    <User className="h-5 w-5 text-[var(--hover-600)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-gray-900">
                      {selectedConversation.admin_name || 'Administrator'}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-400" />
                      Clinic support
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Messages ───────────────────────────────────────────────── */}
              <div className="min-h-0 flex-1 overflow-y-auto bg-gray-50/30 px-5 py-5 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
                        <MessageCircle className="h-6 w-6 text-gray-300" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">Say hello to the clinic</p>
                      <p className="mt-1 text-xs text-gray-400">
                        Your messages will appear here instantly.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message, index) => {
                      const isPatient = message.sender_type === 'patient';
                      const showTimestamp =
                        index === messages.length - 1 ||
                        messages[index + 1]?.sender_type !== message.sender_type;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${isPatient ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                          style={{ animationDelay: `${Math.min(index * 15, 200)}ms` }}
                        >
                          <div className={`max-w-[80%] ${isPatient ? 'order-1' : 'order-1'}`}>
                            <div
                              className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                isPatient
                                  ? 'rounded-br-sm bg-[var(--hover-600)] text-white shadow-sm'
                                  : 'rounded-bl-sm border border-gray-100 bg-white text-gray-800 shadow-sm'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{message.content}</p>
                            </div>
                            {showTimestamp && (
                              <div
                                className={`mt-1 flex items-center gap-1 px-1 ${
                                  isPatient ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                <span
                                  className={`text-[11px] ${
                                    isPatient ? 'text-gray-400' : 'text-gray-400'
                                  }`}
                                >
                                  {formatTime(message.timestamp)}
                                </span>
                                {isPatient && (
                                  <span className="text-gray-300">
                                    {message.read ? (
                                      <CheckCheck className="h-3.5 w-3.5 text-[var(--hover-600)]" />
                                    ) : (
                                      <Check className="h-3.5 w-3.5 text-gray-400" />
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* ── Input Area ─────────────────────────────────────────────── */}
              <div className="border-t border-gray-100 bg-white px-5 py-4">
                <div className="flex items-end gap-3">
                  <div className="relative flex-1">
                    <textarea
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder="Type your message..."
                      className="min-h-[44px] w-full resize-none rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3 pr-12 text-sm text-gray-900 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-[var(--hover-400)] focus:bg-white focus:ring-2 focus:ring-[var(--hover-50)]"
                      style={{ lineHeight: '1.25rem' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-xl bg-[var(--hover-600)] text-white shadow-sm transition-all duration-200 hover:bg-[var(--hover-700)] hover:shadow-md active:scale-[0.95] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  >
                    {sending ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Send className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] text-gray-400">
                  Press Enter to send, Shift+Enter for new line
                </p>
              </div>
            </>
          ) : (
            /* ── No Conversation Selected ─────────────────────────────────── */
            <div className="hidden flex-1 items-center justify-center bg-gray-50/30 md:flex">
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                  <MessageCircle className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-base font-semibold text-gray-900">Choose a conversation</p>
                <p className="mt-1.5 text-sm text-gray-400">
                  Select a conversation from the list to start chatting.
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PatientMessagingView;
