import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, CheckCheck, MessageCircle, Send, User } from 'lucide-react';
import { Conversation, Message } from '../types';
import { api } from '../services/api';
import { auth } from '../services/auth';
import { supabase } from '../services/supabase';

interface MessagingViewProps {
  patients: any[];
  users: any[];
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConversationIdRef = useRef<string | null>(null);

  selectedConversationIdRef.current = selectedConversationId;

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const availablePatients = useMemo(() => {
    const existingPatientIds = new Set(conversations.map((conversation) => conversation.patient_id));
    return patients
      .filter((patient) => patient?.id && patient?.name)
      .filter((patient) => !existingPatientIds.has(patient.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [conversations, patients]);

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
    if (!adminId) return;

    try {
      await api.messages.markAsRead(conversationId, adminId, 'admin');
      const refreshedConversations = await api.messages.getConversations(adminId, 'admin');
      setConversations(refreshedConversations);
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
      const sentMessage = await api.messages.createMessage({
        conversation_id: selectedConversation.id,
        sender_id: adminId,
        sender_type: 'admin',
        recipient_id: selectedConversation.patient_id,
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
      }

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

  const handleOpenConversation = async (patientId: string) => {
    if (!adminId || startingConversation) {
      return;
    }

    const existingConversation = conversations.find((conversation) => conversation.patient_id === patientId);
    if (existingConversation) {
      setSelectedConversationId(existingConversation.id);
      return;
    }

    try {
      setStartingConversation(patientId);
      const conversation = await api.messages.createConversation(patientId, adminId);
      await loadConversations(false);
      setSelectedConversationId(conversation.id);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to start conversation.');
    } finally {
      setStartingConversation(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!messagingEnabled) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Messaging disabled</h2>
        <p className="mt-2 text-sm text-gray-500">Turn the feature back on to chat with patients in real time.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
      <div className="border-b border-gray-200 px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-900">Patient Messages</h2>
        <p className="mt-1 text-sm text-gray-500">Live messaging between the front desk and patient portal.</p>
      </div>

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-6 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-gray-200 bg-gray-50">
          <div className="border-b border-gray-200 px-4 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Conversations</h3>
            <p className="mt-1 text-xs text-gray-500">Updates arrive automatically through Supabase realtime.</p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-b border-gray-200 bg-white">
            {conversations.length === 0 ? (
              <div className="p-6 text-center">
                <MessageCircle className="mx-auto h-10 w-10 text-gray-300" />
                <p className="mt-3 text-sm font-medium text-gray-700">No conversations yet</p>
                <p className="mt-1 text-xs text-gray-500">Start one from the patient list below.</p>
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
                      <div className="truncate text-sm font-semibold text-gray-900">{conversation.patient_name}</div>
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

          <div className="px-4 py-4">
            <h3 className="text-sm font-semibold text-gray-900">Start New Chat</h3>
            <p className="mt-1 text-xs text-gray-500">Choose any patient to open a direct conversation.</p>
          </div>

          <div className="max-h-[280px] overflow-y-auto bg-white">
            {availablePatients.length === 0 ? (
              <div className="px-4 pb-6 text-xs text-gray-500">
                Every patient already has an active conversation with this admin.
              </div>
            ) : (
              availablePatients.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => handleOpenConversation(patient.id)}
                  disabled={startingConversation === patient.id}
                  className="flex w-full items-center justify-between border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="truncate text-sm text-gray-800">{patient.name}</span>
                  <span className="text-xs font-medium text-indigo-600">
                    {startingConversation === patient.id ? 'Opening...' : 'Chat'}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex min-h-0 flex-col">
          {selectedConversation ? (
            <>
              <div className="border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-100">
                    <User className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{selectedConversation.patient_name}</div>
                    <div className="text-xs text-gray-500">Live patient chat</div>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-white px-6 py-5">
                {messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-center">
                    <div>
                      <MessageCircle className="mx-auto h-10 w-10 text-gray-300" />
                      <p className="mt-3 text-sm font-medium text-gray-700">No messages yet</p>
                      <p className="mt-1 text-xs text-gray-500">Send the first message to begin the conversation.</p>
                    </div>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-xl rounded-2xl px-4 py-3 text-sm ${
                          message.sender_type === 'admin'
                            ? 'rounded-br-md bg-indigo-600 text-white'
                            : 'rounded-bl-md bg-gray-100 text-gray-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        <div className={`mt-2 flex items-center gap-1 text-[11px] ${
                          message.sender_type === 'admin' ? 'justify-end text-indigo-100' : 'text-gray-500'
                        }`}>
                          <span>{formatTime(message.timestamp)}</span>
                          {message.sender_type === 'admin' && (
                            message.read ? <CheckCheck className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-200 bg-white px-6 py-4">
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
                    placeholder="Type a message to the patient..."
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
            <div className="flex flex-1 items-center justify-center bg-white px-6 text-center">
              <div>
                <MessageCircle className="mx-auto h-12 w-12 text-gray-300" />
                <p className="mt-4 text-lg font-semibold text-gray-900">Select a conversation</p>
                <p className="mt-2 text-sm text-gray-500">Open an existing chat or start a new one from the patient list.</p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default MessagingView;
