import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Clock, Check, CheckCheck, MessageCircle } from 'lucide-react';
import { Message, Conversation } from '../types';
import { api } from '../services/api';
import { auth } from '../services/auth';

interface MessagingViewProps {
  patients: any[];
  users: any[];
}

const MessagingView: React.FC<MessagingViewProps> = ({ patients, users }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [sessionState, setSessionState] = useState(() => {
    const user = auth.getCurrentUser();
    const isValid = user && 
      user.userId && 
      user.userId !== 'undefined' &&
      user.role === 'admin';
    
    return { user, isValid };
  });
  
  // Memoize session validation to prevent unnecessary re-renders
  const isValidSession = sessionState.isValid;
  const currentUser = sessionState.user;

  // Effect to check session validity periodically
  useEffect(() => {
    const checkSession = () => {
      const user = auth.getCurrentUser();
      
      // Detailed debug logging
      if (process.env.NODE_ENV === 'development') {
        console.log('MessagingView Session Check:', {
          hasUser: !!user,
          userId: user?.userId,
          role: user?.role,
          isUndefined: user?.userId === 'undefined'
        });
      }

      let valid = false;
      let errorMsg = null;

      if (!user || !user.userId || user.userId === 'undefined') {
        valid = false;
        errorMsg = 'Invalid user session. Please log in again.';
      } else if (user.role !== 'admin') {
        valid = false;
        errorMsg = 'Only administrators have permission to use the messaging system.';
      } else {
        valid = true;
      }
        
      setSessionState({ user, isValid: valid });
      
      if (!valid && user) {
        setError(errorMsg);
        setLoading(false);
      } else if (valid) {
        setError(null);
        if (conversations.length === 0) {
          fetchConversations();
        }
      }
    };
    
    // Initial check
    checkSession();
    
    // Set up interval to check session validity
    const sessionCheckInterval = setInterval(checkSession, 60000); // Check every 60 seconds
    
    return () => {
      clearInterval(sessionCheckInterval);
    };
  }, []);

  useEffect(() => {
    const user = auth.getCurrentUser();
    const valid = user && 
      user.userId && 
      user.userId !== 'undefined' &&
      user.role === 'admin';
    
    if (!valid && user) {
      setSessionState({ user, isValid: valid });
      setError('Invalid user session. Please log in again.');
      return;
    }
    
    if (selectedConversation && valid) {
      fetchMessages(selectedConversation.id);
      markConversationAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchConversations = async () => {
    // Re-check session validity before fetching
    const user = auth.getCurrentUser();
    const valid = user && 
      user.userId && 
      user.userId !== 'undefined' &&
      user.role === 'admin';
      
    if (!valid && user) {
      setSessionState({ user, isValid: valid });
      setError('Invalid user session. Please log in again.');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const convs = await api.messages.getConversations(user.userId, 'admin');
      setConversations(convs);
      if (convs.length > 0 && !selectedConversation) {
        setSelectedConversation(convs[0]);
      }
    } catch (err: any) {
      // Check if error is related to session
      if (err.message.includes('Invalid user session') || err.message.includes('session') || err.message.includes('auth')) {
        setError('Invalid user session. Please log in again.');
        setSessionState({ user: null, isValid: false });
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    const user = auth.getCurrentUser();
    const valid = user && 
      user.userId && 
      user.userId !== 'undefined' &&
      user.role === 'admin';
      
    if (!valid && user) {
      setSessionState({ user, isValid: valid });
      setError('Invalid user session. Please log in again.');
      return;
    }
    
    try {
      const msgs = await api.messages.getMessages(conversationId);
      setMessages(msgs);
    } catch (err: any) {
      // Check if error is related to session
      if (err.message.includes('Invalid user session') || err.message.includes('session') || err.message.includes('auth')) {
        setError('Invalid user session. Please log in again.');
        setSessionState({ user: null, isValid: false });
      } else {
        setError(err.message);
      }
    }
  };

  const markConversationAsRead = async (conversationId: string) => {
    const user = auth.getCurrentUser();
    const valid = user && 
      user.userId && 
      user.userId !== 'undefined' &&
      user.role === 'admin';
    
    if (!valid && user) {
      setSessionState({ user, isValid: valid });
      setError('Invalid user session. Please log in again.');
      return;
    }
    
    try {
      await api.messages.markAsRead(conversationId, user.userId, 'admin');
      // Only refresh if we're still on the same conversation
      if (selectedConversation?.id === conversationId) {
        fetchConversations();
      }
    } catch (err: any) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleSendMessage = async () => {
    const user = auth.getCurrentUser();
    const valid = user && 
      user.userId && 
      user.userId !== 'undefined' &&
      user.role === 'admin';
    
    if (!newMessage.trim() || !selectedConversation || !valid || !user?.userId) return;
    
    // Validate current user ID
    if (!user.userId || user.userId === 'undefined') {
      setError('Invalid user session. Please log in again.');
      return;
    }

    try {
      const messageData = {
        conversation_id: selectedConversation.id,
        sender_id: user.userId,
        sender_type: 'admin' as const,
        recipient_id: selectedConversation.patient_id,
        recipient_type: 'patient' as const,
        content: newMessage.trim()
      };

      await api.messages.createMessage(messageData);
      setNewMessage('');
      fetchMessages(selectedConversation.id);
      // Removed fetchConversations() to prevent input field disruption
    } catch (err: any) {
      // Check if error is related to session
      if (err.message.includes('Invalid user session') || err.message.includes('session') || err.message.includes('auth')) {
        setError('Invalid user session. Please log in again.');
        setSessionState({ user: null, isValid: false });
      } else {
        setError(err.message);
      }
    }
  };

  const handleCreateConversation = async (patientId: string) => {
    const user = auth.getCurrentUser();
    const valid = user && 
      user.userId && 
      user.userId !== 'undefined' &&
      user.role === 'admin';
    
    if (!valid || !user?.userId) return;
    
    // Validate current user ID
    if (!user.userId || user.userId === 'undefined') {
      setError('Invalid user session. Please log in again.');
      return;
    }
    
    try {
      const conversation = await api.messages.createConversation(patientId, user.userId);
      setConversations([conversation, ...conversations]);
      setSelectedConversation(conversation);
    } catch (err: any) {
      // Check if error is related to session
      if (err.message.includes('Invalid user session') || err.message.includes('session') || err.message.includes('auth')) {
        setError('Invalid user session. Please log in again.');
        setSessionState({ user: null, isValid: false });
      } else {
        setError(err.message);
      }
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-800">Messaging</h2>
        <p className="text-sm text-gray-500 mt-1">Communicate with patients in real-time</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-b border-red-100">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="flex h-[calc(100vh-200px)]">
        {/* Conversations sidebar */}
        <div className="w-80 border-r border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900">Conversations</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="p-8 text-center">
                <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">No conversations yet</p>
                <p className="text-gray-400 text-xs mt-1">Start a conversation with a patient</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedConversation?.id === conv.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''
                  }`}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 truncate">{conv.patient_name}</h4>
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
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">{selectedConversation.patient_name}</h3>
                    <p className="text-sm text-gray-500">Patient</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_type === 'admin' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                          message.sender_type === 'admin'
                            ? 'bg-indigo-600 text-white rounded-br-md'
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        <div className={`flex items-center mt-1 ${
                          message.sender_type === 'admin' ? 'justify-end' : 'justify-start'
                        }`}>
                          <span className="text-xs opacity-70 mr-1">
                            {formatTime(message.timestamp)}
                          </span>
                          {message.sender_type === 'admin' && (
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
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                <p className="text-gray-500">Choose a conversation from the sidebar to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagingView;