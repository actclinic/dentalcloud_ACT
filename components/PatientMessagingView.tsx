import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, MessageCircle, Send, User } from 'lucide-react';
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

  if (loading) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!messagingEnabled) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Messaging disabled</h2>
        <p className="mt-2 text-sm text-gray-500">Clinic staff can turn this feature back on when needed.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Messages</h2>
        <p className="mt-1 text-xs text-gray-500">Realtime chat with clinic staff.</p>
      </div>

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex min-h-[520px] flex-col md:grid md:grid-cols-[280px_minmax(0,1fr)]">
        <aside className={`${selectedConversation ? 'hidden md:block' : 'block'} border-r border-gray-200 bg-gray-50`}>
          <div className="border-b border-gray-200 px-4 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Conversations</h3>
          </div>

          <div className="max-h-[440px] overflow-y-auto bg-white">
            {conversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-700">No messages yet</p>
                <p className="mt-1 text-xs text-gray-500">Start a conversation with the clinic.</p>
                <button
                  type="button"
                  onClick={handleCreateConversation}
                  disabled={creatingConversation}
                  className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingConversation ? 'Starting...' : 'Start Conversation'}
                </button>
              </div>
            ) : (
              conversations.map((conversation) => (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => setSelectedConversationId(conversation.id)}
                  className={`w-full border-b border-gray-100 px-4 py-4 text-left transition-colors ${
                    selectedConversationId === conversation.id ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{conversation.admin_name || 'Administrator'}</div>
                      <div className="mt-1 truncate text-xs text-gray-500">
                        {conversation.last_message || 'No messages yet'}
                      </div>
                      <div className="mt-2 text-[11px] text-gray-400">
                        {formatConversationTime(conversation.last_message_time || conversation.created_at)}
                      </div>
                    </div>
                    {conversation.unread_count > 0 && (
                      <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-indigo-600 px-2 text-xs font-semibold text-white">
                        {conversation.unread_count}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className={`${selectedConversation ? 'flex' : 'hidden md:flex'} min-h-[520px] flex-col`}>
          {selectedConversation ? (
            <>
              <div className="border-b border-gray-200 px-4 py-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedConversationId(null)}
                    className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 md:hidden"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100">
                    <User className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{selectedConversation.admin_name || 'Administrator'}</div>
                    <div className="text-xs text-gray-500">Clinic support</div>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-white px-4 py-4">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <MessageCircle className="mx-auto h-10 w-10 text-gray-300" />
                      <p className="mt-3 text-sm font-medium text-gray-700">Say hello to the clinic</p>
                      <p className="mt-1 text-xs text-gray-500">Your messages will appear here instantly.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_type === 'patient' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                          message.sender_type === 'patient'
                            ? 'rounded-br-md bg-indigo-600 text-white'
                            : 'rounded-bl-md bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <div className={`mt-2 flex items-center gap-1 text-[11px] ${
                          message.sender_type === 'patient' ? 'justify-end text-indigo-100' : 'text-gray-500'
                        }`}>
                          <span>{formatTime(message.timestamp)}</span>
                          {message.sender_type === 'patient' && (
                            message.read ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-200 bg-white px-4 py-4">
                <div className="flex gap-3">
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
                    placeholder="Message the clinic..."
                    className="min-h-[52px] flex-1 resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sending}
                    className="flex h-[52px] w-[52px] items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="hidden flex-1 items-center justify-center bg-white text-center md:flex">
              <div>
                <MessageCircle className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-lg font-semibold text-gray-900">Choose a conversation</p>
                <p className="mt-2 text-sm text-gray-500">Messages from clinic staff will appear here in real time.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PatientMessagingView;
