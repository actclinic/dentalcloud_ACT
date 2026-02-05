import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Clock, Check, CheckCheck, MessageCircle } from 'lucide-react';
import { Message, Conversation } from '../types';
import { api } from '../services/api';
import { auth } from '../services/auth';
import { supabase } from '../services/supabase';

interface PatientMessagingViewProps {
  currentUser: { userId?: string } | { id: string };
  messagingEnabled: boolean;
}

const PatientMessagingView: React.FC<PatientMessagingViewProps> = ({ currentUser, messagingEnabled }) => {
  const getUserId = (): string | undefined => {
    return ('userId' in currentUser) ? currentUser.userId : ('id' in currentUser) ? (currentUser as any).id : undefined;
  };
  
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if messaging is enabled
  useEffect(() => {
    if (!messagingEnabled) {
      setError('Messaging system is currently disabled by the administrator. Please contact your system admin to enable it.');
      setLoading(false);
    }
  }, [messagingEnabled]);

  // Effect to initialize conversations
  useEffect(() => {
    const userId = getUserId();
    if (currentUser && userId && userId !== 'undefined') {
      fetchConversations(true); // Show loading on initial load
    } else {
      setLoading(false);
      setError('Invalid user session. Please log in again.');
    }
  }, [currentUser]);

  // Effect for background refresh of conversations
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    
    if (currentUser && getUserId() && getUserId() !== 'undefined') {
      refreshInterval = setInterval(async () => {
        try {
          const userId = getUserId();
          if (currentUser && userId && userId !== 'undefined') {
            // Fetch conversations in background
            const convs = await api.messages.getConversations(userId, 'patient');
            
            // Only update conversations if data actually changed
            setConversations(prevConvs => {
              // Compare conversation arrays for changes
              const hasChanges = convs.length !== prevConvs.length || 
                convs.some((conv, index) => {
                  const prevConv = prevConvs[index];
                  return !prevConv || 
                    conv.id !== prevConv.id || 
                    conv.last_message !== prevConv.last_message || 
                    conv.unread_count !== prevConv.unread_count ||
                    conv.last_message_time !== prevConv.last_message_time;
                });
              
              return hasChanges ? convs : prevConvs;
            });
            
            // If we have a selected conversation, refresh it as well
            if (selectedConversation) {
              const msgs = await api.messages.getMessages(selectedConversation.id);
              
              // Only update messages if data actually changed
              setMessages(prevMsgs => {
                // Compare message arrays for changes
                const hasChanges = msgs.length !== prevMsgs.length || 
                  msgs.some((msg, index) => {
                    const prevMsg = prevMsgs[index];
                    return !prevMsg || 
                      msg.id !== prevMsg.id || 
                      msg.content !== prevMsg.content || 
                      msg.read !== prevMsg.read ||
                      msg.timestamp !== prevMsg.timestamp;
                  });
                
                return hasChanges ? msgs : prevMsgs;
              });
            }
          }
        } catch (err: any) {
          // Only show error if it's a session-related issue
          if (err.message.includes('Invalid user session') || err.message.includes('session') || err.message.includes('auth')) {
            setError(err.message);
          }
          // Otherwise, silently ignore network errors during background refresh
        }
      }, 30000); // Refresh every 30 seconds in background
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [currentUser, selectedConversation?.id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id, true); // Show loading when switching conversations
      markConversationAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const userId = getUserId();
      if (currentUser && userId && userId !== 'undefined') {
        const convs = await api.messages.getConversations(userId, 'patient');
        setConversations(convs);
        if (convs.length > 0 && !selectedConversation) {
          setSelectedConversation(convs[0]);
        }
      } else {
        setError('Invalid user session. Please log in again.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const fetchMessages = async (conversationId: string, showLoading = false) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const msgs = await api.messages.getMessages(conversationId);
      setMessages(msgs);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const markConversationAsRead = async (conversationId: string) => {
    const userId = getUserId();
    if (currentUser && userId && userId !== 'undefined') {
      try {
        await api.messages.markAsRead(conversationId, userId, 'patient');
        // Refresh conversations to update unread counts
        fetchConversations(false); // Don't show loading during background update
      } catch (err: any) {
        console.error('Failed to mark as read:', err);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !currentUser) return;
    
    // Validate current user ID
    const userId = getUserId();
    if (!userId || userId === 'undefined') {
      setError('Invalid user session. Please log in again.');
      return;
    }

    try {
      const messageData = {
        conversation_id: selectedConversation.id,
        sender_id: userId,
        sender_type: 'patient' as const,
        recipient_id: selectedConversation.admin_id,
        recipient_type: 'admin' as const,
        content: newMessage.trim()
      };

      await api.messages.createMessage(messageData);
      setNewMessage('');
      fetchMessages(selectedConversation.id, false); // Don't show loading when updating after send
      fetchConversations(false); // Refresh to update last message without showing loading
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCreateConversation = async () => {
    if (!currentUser) return;
    
    // Validate current user ID
    const userId = getUserId();
    if (!userId || userId === 'undefined') {
      setError('Invalid user session. Please log in again.');
      return;
    }
    
    // We'll create a conversation with the first available admin user
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .limit(1);
      
      if (admins && admins.length > 0) {
        const conversation = await api.messages.createConversation(userId, admins[0].id);
        setConversations([conversation, ...conversations]);
        setSelectedConversation(conversation);
      } else {
        setError('No administrators are currently available for messaging.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Show full-screen message when messaging is disabled
  if (!messagingEnabled) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px] bg-gray-50 p-4">
        <div className="text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">Messaging System Disabled</h3>
          <p className="text-gray-600 mb-4">The messaging feature has been temporarily disabled by the system administrator.</p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-800 text-sm rounded-lg border border-amber-200">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            Contact your clinic administrator for assistance.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800">Messages</h2>
        <p className="text-sm text-gray-500 mt-1">Contact clinic staff</p>
        <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Important Notice</p>
              <p className="text-xs text-yellow-700 mt-1">Messages older than 2 months are automatically deleted to maintain system performance.</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="flex flex-col h-[calc(100vh-200px)] md:flex-row">
        {/* Conversations sidebar - hidden by default on mobile, shown when selectedConversation is null */}
        <div className={`${selectedConversation ? 'hidden md:flex' : 'flex'} md:block w-full md:w-80 border-r border-gray-200 flex-col h-[calc(100vh-200px)] md:h-auto`}>
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-medium text-gray-900">Conversations</h3>
            {conversations.length === 0 && (
              <button
                onClick={handleCreateConversation}
                className="bg-indigo-600 text-white text-xs px-3 py-1 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                New Chat
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center">
                <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No conversations yet</p>
                <p className="text-gray-400 text-xs mt-1">Start a conversation with clinic staff</p>
                <button
                  onClick={handleCreateConversation}
                  className="mt-4 bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start Chat
                </button>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                  }`}
                  onClick={() => {
                    setSelectedConversation(conv);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">Administrator</h4>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {conv.last_message || 'No messages yet'}
                      </p>
                    </div>
                    {conv.unread_count > 0 && (
                      <span className="ml-2 bg-indigo-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center flex-shrink-0">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  {conv.last_message_time && (
                    <p className="text-xs text-gray-400 mt-2">
                      {formatDate(conv.last_message_time)} • {formatTime(conv.last_message_time)}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col h-[calc(100vh-200px)] md:h-auto">
          {selectedConversation ? (
            <>
              {/* Header with back button on mobile */}
              <div className="p-4 border-b border-gray-200 flex items-center">
                <button 
                  onClick={() => setSelectedConversation(null)}
                  className="md:hidden mr-3 p-1 rounded-full hover:bg-gray-100"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Administrator</h3>
                    <p className="text-sm text-gray-500">Messaging Support</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_type === 'patient' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[85%] sm:max-w-xs px-4 py-2 rounded-2xl ${
                          message.sender_type === 'patient'
                            ? 'bg-indigo-600 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className={`flex items-center mt-1 ${
                          message.sender_type === 'patient' ? 'justify-end' : 'justify-start'
                        }`}>
                          <span className="text-xs opacity-70 mr-1">
                            {formatTime(message.timestamp)}
                          </span>
                          {message.sender_type === 'patient' && (
                            message.read ? (
                              <CheckCheck className="w-3 h-3 opacity-70" />
                            ) : (
                              <Check className="w-3 h-3 opacity-70" />
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>

              <div className="p-4 border-t border-gray-200">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type your message..."
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    className="bg-indigo-600 text-white p-2 rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations</h3>
                <p className="text-gray-500">Start a conversation to contact clinic staff</p>
                <button
                  onClick={handleCreateConversation}
                  className="mt-4 bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Start Conversation
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientMessagingView;