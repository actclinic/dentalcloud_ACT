import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Sparkles, AlertCircle, User, Copy, Check, Plus, Trash2, MessageCircle, Zap, ShieldQuestion, Mic, HelpCircle, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Patient, ClinicalRecord, Appointment, Doctor, TreatmentType, User as UserType, Medicine, Expense } from '../types';
import { api } from '../services/api';

// Custom CSS for animations
const customStyles = `
  @keyframes fade-in-up {
    0% {
      opacity: 0;
      transform: translateY(20px);
    }
    100% {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
  
  .animate-fade-in-up {
    animation: fade-in-up 0.3s ease-out forwards;
  }
  
  .animate-shake {
    animation: shake 0.5s ease-in-out;
  }
  
  /* Markdown styling for AI responses */
  .ai-markdown {
    line-height: 1.6;
  }
  
  .ai-markdown h1, .ai-markdown h2, .ai-markdown h3, .ai-markdown h4, .ai-markdown h5, .ai-markdown h6 {
    margin-top: 1.5em;
    margin-bottom: 0.75em;
    font-weight: 600;
    color: #1e293b;
  }
  
  .ai-markdown h1 { font-size: 1.5em; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.3em; }
  .ai-markdown h2 { font-size: 1.3em; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.2em; }
  .ai-markdown h3 { font-size: 1.15em; }
  .ai-markdown h4 { font-size: 1.1em; }
  
  .ai-markdown p {
    margin-bottom: 1em;
  }
  
  .ai-markdown ul, .ai-markdown ol {
    margin: 1em 0;
    padding-left: 1.5em;
  }
  
  .ai-markdown li {
    margin-bottom: 0.5em;
  }
  
  .ai-markdown code {
    background-color: #f1f5f9;
    padding: 0.2em 0.4em;
    border-radius: 0.375rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: 0.875em;
    color: #dc2626;
  }
  
  .ai-markdown pre {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1em;
    overflow-x: auto;
    margin: 1em 0;
  }
  
  .ai-markdown pre code {
    background-color: transparent;
    padding: 0;
    color: #334155;
    font-size: 0.875em;
  }
  
  .ai-markdown blockquote {
    border-left: 4px solid #94a3b8;
    padding-left: 1em;
    margin: 1em 0;
    color: #64748b;
    font-style: italic;
  }
  
  .ai-markdown table {
    width: 100%;
    border-collapse: collapse;
    margin: 1em 0;
    background-color: white;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }
  
  .ai-markdown th {
    background-color: #f1f5f9;
    font-weight: 600;
    text-align: left;
    padding: 0.75em 1em;
    border-bottom: 2px solid #e2e8f0;
  }
  
  .ai-markdown td {
    padding: 0.75em 1em;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .ai-markdown tr:last-child td {
    border-bottom: none;
  }
  
  .ai-markdown tr:hover {
    background-color: #f8fafc;
  }
  
  .ai-markdown a {
    color: #4f46e5;
    text-decoration: underline;
    font-weight: 500;
  }
  
  .ai-markdown a:hover {
    color: #4338ca;
  }
  
  .ai-markdown hr {
    border: none;
    height: 1px;
    background-color: #e2e8f0;
    margin: 1.5em 0;
  }
  
  .ai-markdown strong {
    font-weight: 600;
    color: #1e293b;
  }
  
  .ai-markdown em {
    font-style: italic;
    color: #64748b;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = customStyles;
  document.head.appendChild(styleSheet);
}

// ============================================================
// IMPORTANT: REPLACE MOCK API KEY WITH YOUR REAL API KEY FROM APIFREE.AI
// ============================================================
// This is a MOCK API key for demonstration purposes.
// To use the real AI Assistant:
// 1. Get your API key from: https://apifree.ai
// 2. Add it to your .env file as: AI_API_KEY=your_actual_api_key_here
// 3. The vite.config.ts is already configured to read it as process.env.AI_API_KEY
// ============================================================
const MOCK_API_KEY = 'REPLACE_WITH_YOUR_AI_API_KEY';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  feedback?: 'helpful' | 'not-helpful' | null;
}

// Interface for pending actions that require confirmation
interface PendingAction {
  action: string;
  params: any;
  originalRequest: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

interface AIAssistantViewProps {
  patients: Patient[];
  treatmentRecords: ClinicalRecord[];
  appointments: Appointment[];
  doctors: Doctor[];
  treatmentTypes: TreatmentType[];
  users: UserType[];
  medicines: Medicine[];
  expenses: Expense[];
}

const AIAssistantView: React.FC<AIAssistantViewProps> = ({ 
  patients, 
  treatmentRecords,
  appointments,
  doctors,
  treatmentTypes,
  users,
  medicines,
  expenses
}) => {
  const DAILY_LIMIT = 10;

  const getDefaultMessages = (): Message[] => [{
    id: '1',
    role: 'assistant',
    content: `👋 Hello! I'm Loli, your AI Clinical Assistant. I can help you with:

• Patient case analysis
• Treatment recommendations
• Dental diagnosis suggestions
• Clinical documentation
• Medical history interpretation

How can I assist you today?

💡 *Note: You have ${DAILY_LIMIT} free requests per day.*`,
    timestamp: new Date()
  }];

  // Daily usage limit tracking
  const [dailyUsageCount, setDailyUsageCount] = useState<number>(() => {
    const today = new Date().toDateString();
    const savedData = localStorage.getItem('loli_usage');
    if (savedData) {
      const { date, count } = JSON.parse(savedData);
      if (date === today) {
        return count;
      }
    }
    return 0;
  });
  
  // Chat session state
  const [chatSessions, setChatSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('loli_chat_sessions');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Convert timestamp strings back to Date objects
      return parsed.map((session: any) => ({
        ...session,
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt),
        messages: session.messages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
      }));
    }
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('loli_current_session');
    return saved || '';
  });
  const [messages, setMessages] = useState<Message[]>(() => {
    if (currentSessionId) {
      const session = chatSessions.find(s => s.id === currentSessionId);
      if (session) {
        // Ensure timestamps are Date objects
        return session.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
        }));
      }
    }
    return getDefaultMessages();
  });
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'ask' | 'agent'>(() => {
    const saved = localStorage.getItem('loli_mode');
    return (saved === 'ask' || saved === 'agent') ? saved : 'ask';
  });
  
  useEffect(() => {
    localStorage.setItem('loli_mode', mode);
  }, [mode]);

  const [apiStatus, setApiStatus] = useState<'ready' | 'mock' | 'error'>('mock');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  // State for pending actions that require confirmation
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  
  // Feedback system state
  const [feedbackStatus, setFeedbackStatus] = useState<Record<string, 'helpful' | 'not-helpful' | null>>({});
  
  // Enhanced conversation context with multi-turn awareness
  const [conversationContext, setConversationContext] = useState<{
    lastUserMessage: string | null;
    lastAssistantResponse: string | null;
    pendingConfirmation: boolean;
    currentWorkflow: string | null; // Track ongoing workflows
    workflowStep: number; // Track progress in multi-step processes
    contextSummary: string; // Brief summary of conversation context
    feedbackPatterns: {
      helpfulCount: number;
      notHelpfulCount: number;
      lastFeedbackTime: Date | null;
    }; // Track feedback patterns for AI improvement
  }>({
    lastUserMessage: null,
    lastAssistantResponse: null,
    pendingConfirmation: false,
    currentWorkflow: null,
    workflowStep: 0,
    contextSummary: '',
    feedbackPatterns: {
      helpfulCount: 0,
      notHelpfulCount: 0,
      lastFeedbackTime: null
    }
  });
  // Help modal state
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [helpContent, setHelpContent] = useState<string>('');

  // Enhanced context summary generator for better continuity
  const generateContextSummary = (userMessage: string, assistantResponse: string): string => {
    const lowerUser = userMessage.toLowerCase();
    const lowerAssistant = assistantResponse.toLowerCase();
    
    // Identify workflow type
    if (lowerUser.includes('treatment') && lowerUser.includes('plan')) {
      return 'Treatment planning discussion';
    } else if (lowerUser.includes('inventory') || lowerUser.includes('stock')) {
      return 'Inventory management discussion';
    } else if (lowerUser.includes('appointment') || lowerUser.includes('schedule')) {
      return 'Appointment scheduling discussion';
    } else if (lowerUser.includes('financial') || lowerUser.includes('report')) {
      return 'Financial analysis discussion';
    } else if (lowerUser.includes('patient') && (lowerUser.includes('find') || lowerUser.includes('search'))) {
      return 'Patient lookup discussion';
    }
    
    return 'General dental practice discussion';
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Enhanced speech recognition with SpeechGrammarList for better accuracy
  const recognition = useRef<any>(null);
  
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognition.current = new SpeechRecognition();
      
      // Optimized settings for better accuracy
      recognition.current.continuous = false;  // Single utterance mode for better control
      recognition.current.interimResults = false;  // Only final results for cleaner output
      recognition.current.lang = 'my-MM';  // Myanmar language support
      
      // Enhanced configuration for better performance
      recognition.current.maxAlternatives = 3;  // Multiple recognition options
      
      // SpeechGrammarList for dental/medical vocabulary
      if ('SpeechGrammarList' in window) {
        try {
          const grammarList = new (window as any).SpeechGrammarList();
          
          // Custom grammar for dental clinic terminology
          const dentalGrammar = `#JSGF V1.0;
            grammar dental;
            
            public <patient> = patient | customers | client | လူနာ | လူေနာ |
                                ပါတိုင္ | လူနာကို | လူေနာကို;
            
            public <medical> = medicine | medicines | drugs | ဆေး | ဆေးဝါး |
                              treatment | treatments | ကုသမှု | ကုသခြင်း |
                              appointment | appointments | ခ်ိန်းတွေ့ | ချိန်းတွေ့ |
                              doctor | doctors | ဆရာဝန် | ဆရာဝန်ကြီး;
            
            public <dental> = tooth | teeth | သွား | သွားများ |
                             filling | fillings | ဖြည့်ဆည်းခြင်း | ဖြည့်ဆည်း |
                             cleaning | cleanings | သန့်ရှင်းရေး | သန့်ရှင်း |
                             extraction | extractions | ထုတ်ယူခြင်း | ထုတ်ယူ |
                             checkup | checkups | စစ်ဆေးခြင်း | စစ်ဆေး;
            
            public <actions> = book | schedule | record | process | create | add |
                              စာရင္းသြင္း | စာရင္း | ခ်ိန္းတြဲ |
                              ခ်ိန္း | သိမ္းဆည္း | ဖတ္ရန္ |
                              ဖတ္ပါ | ဖတ္ေပးပါ;
            
            public <numbers> = one | two | three | four | five | six | seven | eight | nine | ten |
                              တစ္ | နွစ္ | သံုး | လေး | ငါး | ခြောက် |
                              ခုနစ္ | ရှစ္ | ကိုး | တစ္ဆယ္;
            
            public <common> = today | tomorrow | next | this | please | help | need |
                             ယနေ့ | မနက်ဖြန် | နောက် | ဒီ | ကျေးဇူးပြုပြီး |
                             ကူညီပေးပါ | လိုအပ် | လိုအပ္;`;
          
          grammarList.addFromString(dentalGrammar, 1);
          recognition.current.grammars = grammarList;
        } catch (error) {
          console.log('SpeechGrammarList not supported or failed to load');
        }
      }
      
      // Speech recognition is now configured with optimized settings above
      
      recognition.current.onresult = (event: any) => {
        let transcript = '';
        let confidence = 0;
        
        // Process results with confidence scoring
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i][0];
          transcript += result.transcript;
          confidence = Math.max(confidence, result.confidence);
        }
        
        // Clean up the transcript
        transcript = transcript.trim();
        
        // Only update if we have meaningful content
        if (transcript.length > 0) {
          // Update the input field
          setInputMessage(transcript);
          
          // Store in conversation context
          setConversationContext(prev => ({
            ...prev,
            lastUserMessage: transcript,
            pendingConfirmation: pendingAction !== null,
            contextSummary: prev.contextSummary || generateContextSummary(transcript, prev.lastAssistantResponse || '')
          }));
          
          console.log(`Speech recognized with ${Math.round(confidence * 100)}% confidence: ${transcript}`);
        }
      };
      
      recognition.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        setIsProcessing(false);
        
        // Provide user-friendly error messages
        let errorMessage = 'Speech recognition failed. ';
        switch(event.error) {
          case 'no-speech':
            errorMessage += 'No speech detected. Please try again.';
            break;
          case 'audio-capture':
            errorMessage += 'Microphone access denied or not available.';
            break;
          case 'not-allowed':
            errorMessage += 'Please allow microphone access in your browser settings.';
            break;
          case 'network':
            errorMessage += 'Network error. Please check your connection.';
            break;
          default:
            errorMessage += 'Please check your microphone and try again.';
        }
        
        // Show error in UI
        const errorId = Date.now().toString();
        const errorMessageObj: Message = {
          id: errorId,
          role: 'assistant',
          content: `⚠️ ${errorMessage}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessageObj]);
      };
      
      recognition.current.onend = () => {
        // Recognition ended - check if we have valid input
        const currentInput = inputMessage.trim();
        
        if (currentInput.length > 0) {
          // Valid speech captured - show processing state
          setIsProcessing(true);
          
          // Small delay to show processing, then auto-send if in listening mode
          setTimeout(() => {
            setIsListening(false);
            setIsProcessing(false);
            
            // Auto-send the message if it's a reasonable length
            if (currentInput.length > 1) {
              console.log('Auto-sending recognized speech:', currentInput);
              handleSendMessage();
            }
          }, 500);
        } else {
          // No valid input - just stop listening
          setIsListening(false);
          setIsProcessing(false);
        }
      };
    }
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Add subtle typing indicator effect
  const [isTyping, setIsTyping] = useState(false);
  
  useEffect(() => {
    if (isLoading) {
      setIsTyping(true);
      const timer = setTimeout(() => setIsTyping(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load help content and feedback on component mount
  useEffect(() => {
    const loadHelpContent = async () => {
      try {
        // Load the beginner-friendly guide content
        const content = `AI ASSISTANT BEGINNER'S GUIDE
=============================

WELCOME!
--------
This is your friendly guide to using the Dental Cloud AI Assistant (Loli).

GETTING STARTED
---------------
1. Type your questions naturally in the chat box below
2. Click the microphone 🎤 to speak instead of typing
3. Use "Ask Mode" for questions, "Agent Mode" for making changes

BASIC COMMANDS
==============
Finding Patients:
• "Do we have a patient named John Smith?"
• "Find patient Sarah Johnson"

Adding Patients (Agent Mode):
• "Add new patient Michael Brown" 
• Follow the prompts for email, phone, and medical history

Scheduling Appointments:
• "Book Sarah Johnson for a checkup next Tuesday at 2 PM"
• "When is Dr. Wilson available this week?"

Recording Treatments (Agent Mode):
• "Record that I completed a filling on tooth #18 for John Smith, cost $150"
• "I did cleanings on teeth 16-18 and 26-28 for Mary Johnson, $200 total"

Managing Medications:
• "Which medicines are running low?"
• "Restock Amoxicillin by 25 units"
• "Add Ibuprofen 400mg to our inventory"

Processing Payments (Agent Mode):
• "Process a payment of $175 from Sarah Johnson"
• "Show me today's revenue"

HELPFUL TIPS
============
✅ Always check if a patient exists before adding them
✅ Switch to Agent Mode (purple button) for making changes
✅ Speak naturally - Loli understands conversational language  
✅ You can mix voice and text input
✅ Loli will guide you through multi-step processes
✅ Check inventory before prescribing medications

COMMON WORKFLOWS
================
New Patient Visit:
1. "Do we have patient Michael Brown?" 
2. If new: "Add Michael Brown" (follow prompts)
3. "Book him for an exam next Monday at 9 AM"

Treatment Session:
1. "Record filling on tooth #19 for John Smith, $175"
2. "Process his payment of $175"
3. "Schedule follow-up in 6 months"

Inventory Management:
1. "Show me low stock items"
2. "Restock Amoxicillin by 30 units"
3. "Verify updated inventory"

MODE EXPLANATIONS
=================
ASK MODE (Green):
• Answer questions about dental topics
• Show reports and information
• Provide treatment recommendations
• Cannot make changes to your data

AGENT MODE (Purple):
• Create/update/delete patient records
• Schedule and modify appointments  
• Record treatments and procedures
• Process payments
• Manage medications
• Required for all data-changing actions

TROUBLESHOOTING
===============
"Agent Mode Required":
→ Click the purple Agent Mode button, then try again

"Patient not found":
→ First search: "Find patient [name]" to verify they exist

"Insufficient stock":
→ Check inventory: "Which medicines are running low?"

Need more detailed help? 
→ Refer to AI_ASSISTANT_BEGINNER_GUIDE.txt in your project folder
→ Or contact your system administrator`;
        setHelpContent(content);
      } catch (error) {
        console.error('Failed to load help content:', error);
        setHelpContent('Quick Reference Guide\n\nFor complete beginner documentation, please refer to the AI_ASSISTANT_BEGINNER_GUIDE.txt file in your project directory.');
      }
    };

    loadHelpContent();
    loadStoredFeedback(); // Load feedback data
  }, []);

  // Cleanup old chat sessions on mount and at regular intervals
  useEffect(() => {
    // Run cleanup immediately on mount
    cleanupOldSessions();
    
    // Set up periodic cleanup (every 24 hours)
    const cleanupInterval = setInterval(() => {
      cleanupOldSessions();
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
    
    return () => clearInterval(cleanupInterval);
  }, [chatSessions]);

  // Check if real API key is configured
  useEffect(() => {
    const apiKey = process.env.AI_API_KEY || MOCK_API_KEY;
    if (apiKey === MOCK_API_KEY || apiKey === 'REPLACE_WITH_YOUR_AI_API_KEY') {
      setApiStatus('mock');
    } else {
      setApiStatus('ready');
    }
  }, []);

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Feedback system functions
  const handleFeedback = (messageId: string, feedback: 'helpful' | 'not-helpful') => {
    // Update local feedback state
    setFeedbackStatus(prev => ({
      ...prev,
      [messageId]: feedback
    }));
    
    // Update the message with feedback
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, feedback } : msg
    ));
    
    // Update conversation context with feedback patterns
    setConversationContext(prev => {
      const countKey = feedback === 'helpful' ? 'helpfulCount' : 'notHelpfulCount';
      const newPattern = {
        ...prev.feedbackPatterns,
        [countKey]: prev.feedbackPatterns[countKey] + 1,
        lastFeedbackTime: new Date()
      };
      
      return {
        ...prev,
        feedbackPatterns: newPattern
      };
    });
    
    // Store feedback in localStorage for persistence
    const storedFeedback = JSON.parse(localStorage.getItem('loli_feedback') || '{}');
    storedFeedback[messageId] = {
      feedback,
      timestamp: new Date().toISOString(),
      contentPreview: messages.find(m => m.id === messageId)?.content.substring(0, 50) || ''
    };
    localStorage.setItem('loli_feedback', JSON.stringify(storedFeedback));
  };

  // Function to load feedback from localStorage on component mount
  const loadStoredFeedback = () => {
    const storedFeedback = JSON.parse(localStorage.getItem('loli_feedback') || '{}');
    const initialFeedbackStatus: Record<string, 'helpful' | 'not-helpful' | null> = {};
    
    Object.keys(storedFeedback).forEach(messageId => {
      initialFeedbackStatus[messageId] = storedFeedback[messageId].feedback;
    });
    
    setFeedbackStatus(initialFeedbackStatus);
  };

  const createNewSession = () => {
    const sessionId = Date.now().toString();
    const newSession: ChatSession = {
      id: sessionId,
      title: 'New Conversation',
      messages: getDefaultMessages(),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const updated = [newSession, ...chatSessions];
    setChatSessions(updated);
    setCurrentSessionId(sessionId);
    setMessages(newSession.messages);
    localStorage.setItem('loli_chat_sessions', JSON.stringify(updated));
    localStorage.setItem('loli_current_session', sessionId);
  };

  const switchSession = (sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      // Ensure timestamps are Date objects when switching sessions
      const messagesWithDates = session.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp)
      }));
      setMessages(messagesWithDates);
      localStorage.setItem('loli_current_session', sessionId);
    }
  };

  const deleteSession = (sessionId: string) => {
    const updated = chatSessions.filter(s => s.id !== sessionId);
    setChatSessions(updated);
    if (currentSessionId === sessionId) {
      if (updated.length > 0) {
        switchSession(updated[0].id);
      } else {
        setCurrentSessionId('');
        setMessages(getDefaultMessages());
        localStorage.removeItem('loli_current_session');
      }
    }
    localStorage.setItem('loli_chat_sessions', JSON.stringify(updated));
  };

  const saveSession = (newMessages: Message[]) => {
    // If there's no current session, create one
    if (!currentSessionId) {
      const sessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: sessionId,
        title: newMessages.find(m => m.role === 'user')?.content.substring(0, 30) + '...' || 'New Conversation',
        messages: newMessages,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const updated = [newSession, ...chatSessions];
      setChatSessions(updated);
      setCurrentSessionId(sessionId);
      setMessages(newMessages);
      localStorage.setItem('loli_chat_sessions', JSON.stringify(updated));
      localStorage.setItem('loli_current_session', sessionId);
      return;
    }
    
    const updated = chatSessions.map(s => {
      if (s.id === currentSessionId) {
        const userMsg = newMessages.find(m => m.role === 'user');
        const title = userMsg?.content.substring(0, 30) + '...' || s.title;
        return { ...s, messages: newMessages, title, updatedAt: new Date() };
      }
      return s;
    });
    setChatSessions(updated);
    localStorage.setItem('loli_chat_sessions', JSON.stringify(updated));
  };

  const cleanupOldSessions = () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const filtered = chatSessions.filter(session => {
      const sessionDate = session.createdAt instanceof Date ? session.createdAt : new Date(session.createdAt);
      return sessionDate > threeDaysAgo;
    });
    
    // Only update if something was deleted
    if (filtered.length < chatSessions.length) {
      setChatSessions(filtered);
      localStorage.setItem('loli_chat_sessions', JSON.stringify(filtered));
      
      // If current session was deleted, switch to first available
      if (!filtered.find(s => s.id === currentSessionId)) {
        if (filtered.length > 0) {
          switchSession(filtered[0].id);
        } else {
          setCurrentSessionId('');
          setMessages(getDefaultMessages());
          localStorage.removeItem('loli_current_session');
        }
      }
    }
  };

  // Token-optimized context builder for cost-effective AI operations
  const getOptimizedContextData = (isActionQuery: boolean = false, maxTokens: number = 1500) => {
    const today = new Date().toISOString().split('T')[0];
    const baseData = {
      td: today,
      s: {
        p: patients.length,
        a: appointments.length,
        d: doctors.length,
        t: treatmentTypes.length,
        m: medicines.length
      }
    };

    // Calculate approximate token usage for different context levels
    const baseTokens = JSON.stringify(baseData).length / 4; // Rough approximation
    const askModeTokens = 300; // Compressed data
    const agentModeTokens = 800; // Extended data
    const advancedTokens = 1200; // Full context with analytics

    if (!isActionQuery && mode === 'ask') {
      // Ultra-compressed mode for minimal token usage
      return {
        ...baseData,
        dr: doctors.slice(0, 5).map(d => ({ n: d.name, s: d.specialization.substring(0, 20) })), 
        ta: appointments.filter(a => a.status === 'Scheduled' && a.date === today).slice(0, 3).map(a => ({ p: a.patient_name.substring(0, 15), t: a.time })),
        inv: {
          total: medicines.length,
          low: medicines.filter(m => m.stock <= (m.min_stock || 0)).length
        }
      };
    }

    if (isActionQuery && maxTokens < 1000) {
      // Medium context for action queries with token constraints
      return {
        ...baseData,
        patients: patients.slice(0, 10).map(p => ({ i: p.id, n: p.name.substring(0, 20), ph: p.phone })),
        doctors: doctors.slice(0, 8).map(d => ({ i: d.id, n: d.name, s: d.specialization })),
        medicines: medicines.slice(0, 10).map(m => ({ i: m.id, n: m.name.substring(0, 25), s: m.stock }))
      };
    }

    // Full context for complex operations
    return getContextualData(isActionQuery);
  };

  const getContextualData = (isActionQuery: boolean = false) => {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    // Basic stats always included
    const baseData = {
      td: today,
      s: {
        p: patients.length,
        a: appointments.length,
        d: doctors.length,
        t: treatmentTypes.length,
        m: medicines.length,
        u: users.length,
        l: 1 // locations count
      }
    };

    if (!isActionQuery && mode === 'ask') {
      // Highly optimized/compressed data for minimal token usage
      return {
        ...baseData,
        dr: doctors.map(d => ({ i: d.id, n: d.name, s: d.specialization })), 
        ta: appointments.filter(a => a.status === 'Scheduled' && a.date === today).map(a => ({ p: a.patient_name, d: a.doctor_name, t: a.time })),
        ua: appointments.filter(a => a.status === 'Scheduled' && a.date >= today).slice(0, 5).map(a => ({ p: a.patient_name, d: a.doctor_name, dt: a.date, t: a.time })),
        tr: treatmentRecords.slice(0, 5).map(r => ({ p: r.patient_name, d: r.description, dt: r.date })),
        ls: medicines.filter(m => m.stock <= (m.min_stock || 0)).map(m => ({ n: m.name, q: m.stock })),
        inv: {
          total_items: medicines.length,
          total_stock: medicines.reduce((sum, med) => sum + (med.stock || 0), 0),
          low_stock_count: medicines.filter(m => m.stock <= (m.min_stock || 0)).length
        }
      };
    }

    // Extended context for Agent Mode or Action queries with enhanced data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const sixMonthsAgoStr = sixMonthsAgo.toISOString().split('T')[0];

    // Identify patients overdue for checkup (no treatments in 6 months)
    const overdueCheckups = patients.filter(p => {
      const lastTreatment = treatmentRecords.find(tr => tr.patient_id === p.id);
      return !lastTreatment || lastTreatment.date < sixMonthsAgoStr;
    }).slice(0, 5).map(p => ({ n: p.name, last: treatmentRecords.find(tr => tr.patient_id === p.id)?.date || 'Never' }));

    // Identify high-priority stock issues
    const criticalStock = medicines.filter(m => m.stock <= (m.min_stock || 0) * 0.2).map(m => ({ n: m.name, s: m.stock, m: m.min_stock }));

    // Identify high outstanding balances
    const highBalances = patients.filter(p => (p.balance || 0) > 500000).slice(0, 5).map(p => ({ n: p.name, b: p.balance }));

    const monthlyRevenue = treatmentRecords.filter(tr => {
      const recordDate = new Date(tr.date);
      const currentDate = new Date();
      return recordDate.getMonth() === currentDate.getMonth() && 
             recordDate.getFullYear() === currentDate.getFullYear();
    }).reduce((sum, tr) => sum + (tr.cost || 0), 0);

    const monthlyExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      const currentDate = new Date();
      return expDate.getMonth() === currentDate.getMonth() && 
             expDate.getFullYear() === currentDate.getFullYear();
    }).reduce((sum, exp) => sum + (exp.amount || 0), 0);

    return {
      ...baseData,
      clinical_insights: {
        overdue_checkups: overdueCheckups,
        high_risk_conditions: patients.filter(p => p.medicalHistory?.match(/heart|diabetes|allergy/i)).slice(0, 5).map(p => ({ n: p.name, c: p.medicalHistory?.substring(0, 30) })),
        upcoming_appointments: appointments.filter(a => a.date === today && a.status === 'Scheduled').length
      },
      operational_insights: {
        critical_stock: criticalStock,
        high_balances: highBalances,
        doctors_free_today: doctors.filter(d => !appointments.some(a => a.doctor_id === d.id && a.date === today)).map(d => d.name)
      },
      patients: patients.slice(0, 25).map(p => ({ 
        i: p.id, 
        n: p.name, 
        ph: p.phone, 
        b: p.balance,
        lp: p.loyalty_points,
        mh: p.medicalHistory ? p.medicalHistory.substring(0, 100) : ''
      })),
      doctors: doctors.map(d => ({ 
        i: d.id, 
        n: d.name, 
        s: d.specialization, 
        sch: d.schedules,
        appts_today: appointments.filter(a => a.doctor_id === d.id && a.date === today && a.status === 'Scheduled').length
      })),
      appointments: appointments.filter(a => a.date >= sevenDaysAgoStr).slice(0, 30).map(a => ({ 
        i: a.id, 
        p: a.patient_name, 
        pi: a.patient_id, 
        d: a.doctor_name, 
        di: a.doctor_id, 
        dt: a.date, 
        t: a.time, 
        s: a.status,
        ty: a.type
      })),
      medicines: medicines.slice(0, 25).map(m => ({ 
        i: m.id, 
        n: m.name, 
        s: m.stock, 
        ms: m.min_stock, 
        p: m.price,
        c: m.category,
        sales_7days: 0 // Would be calculated from sales data
      })),
      treatment_records: treatmentRecords.slice(0, 20).map(tr => ({
        i: tr.id,
        pid: tr.patient_id,
        pn: tr.patient_name,
        t: tr.teeth,
        d: tr.description,
        c: tr.cost,
        dt: tr.date
      })),
      expenses: expenses.slice(0, 20).map(exp => ({
        i: exp.id,
        d: exp.description,
        a: exp.amount,
        c: exp.category,
        dt: exp.date
      })),
      financial_summary: {
        daily_revenue: treatmentRecords.filter(tr => tr.date === today).reduce((sum, tr) => sum + (tr.cost || 0), 0),
        weekly_revenue: treatmentRecords.filter(tr => tr.date >= sevenDaysAgoStr).reduce((sum, tr) => sum + (tr.cost || 0), 0),
        monthly_revenue: monthlyRevenue,
        daily_expenses: expenses.filter(exp => exp.date === today).reduce((sum, exp) => sum + (exp.amount || 0), 0),
        weekly_expenses: expenses.filter(exp => exp.date >= sevenDaysAgoStr).reduce((sum, exp) => sum + (exp.amount || 0), 0),
        monthly_expenses: monthlyExpenses,
        monthly_profit: monthlyRevenue - monthlyExpenses
      },
      inventory_insights: {
        low_stock_items: medicines.filter(m => m.stock <= (m.min_stock || 0)).length,
        out_of_stock_items: medicines.filter(m => m.stock === 0).length,
        total_inventory_value: medicines.reduce((sum, m) => sum + (m.stock * m.price), 0),
        fast_moving_items: medicines.slice(0, 5).map(m => ({ n: m.name, s: m.stock })) // Placeholder
      },
      loc: users[0]?.location_id || 'main' // Use first user's location as default
    };
  };

  // Helper function to validate JSON
  const isValidJson = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  };

  const API_DOCS = `
ACTIONS (Available in all modes - Full Database Access):

PATIENT MANAGEMENT:
- p_c(n, e, ph, m, lp): Create patient. n=name, e=email, ph=phone, m=medicalHistory, lp=loyalty_points.
- p_u(id, data): Update patient. data: {name, email, phone, medicalHistory, balance, loyalty_points, etc}.
- p_d(id): Delete patient.
- p_find(name): Find patient by name (partial match).
- pat_bal(pid): Get patient balance and loyalty points.
- pat_hist(pid): Get patient treatment history.
- pat_loyalty_history(pid): Get patient loyalty transaction history.

APPOINTMENT MANAGEMENT:
- apt_c(p_id, dr_id, dt, t, ty, n): Create appointment. p_id=patient id (or use "name"), dr_id=doctor id, dt=date(YYYY-MM-DD), t=time(HH:mm), ty=type, n=notes.
- apt_u(id, data): Update appointment. data can include {date, time, status, doctor_id, etc}.
- apt_d(id): Delete appointment.
- apt_reschedule(id, dt, t): Reschedule appointment.
- apt_status(id, status): Update appointment status.
- apt_find_patient(name): Find appointments for patient.
- staff_availability(date, dr_id): Check doctor availability for date.
- bulk_appointments(patients[], dr_id, date, time): Schedule multiple appointments.

DOCTOR MANAGEMENT:
- dr_c(n, e, ph, s, sch): Create doctor. n=name, e=email, ph=phone, s=specialization, sch=schedules.
- dr_u(id, data): Update doctor.
- dr_d(id): Delete doctor.
- dr_schedule_add(dr_id, day, start, end): Add doctor schedule.
- dr_schedule_update(id, data): Update doctor schedule.
- dr_schedule_remove(id): Remove doctor schedule.

MEDICATION INVENTORY:
- m_c(n, d, u, p, s, ms, c): Create medicine. n=name, d=description, u=unit, p=price, s=stock, ms=min_stock, c=category.
- m_u(id, data): Update medicine.
- m_d(id): Delete medicine.
- m_restock(id, qty): Restock medicine. id=medicine id, qty=quantity to add.
- m_sell(pid, mid, qty, tid): Sell medicine. pid=patient id, mid=medicine id, qty=quantity, tid=treatment id (optional).
- inv_low(): Get low stock report.
- inv_out(): Get out-of-stock items.
- inv_reorder_suggestions(): Get automatic reorder recommendations.
- inventory_audit(): Complete inventory status and recommendations.
- med_sales_report(): Get medicine sales summary.

TREATMENT RECORDS:
- tr_create(pid, teeth[], desc, cost, meds[]): Record treatment. pid=patient id (or use "name"), teeth=array of tooth numbers, desc=description, cost=amount, meds=[{id, qty}].
- tr_undo(id, pid, cost): Undo treatment record.
- treatment_plan(patient_name, symptoms, proposed_treatments[]): AI-assisted treatment planning.
- treatment_types_get(): Get all treatment types.
- treatment_type_create(name, cost, category): Create treatment type.
- treatment_type_update(id, data): Update treatment type.
- treatment_type_delete(id): Delete treatment type.

FINANCIAL OPERATIONS:
- fin_pay(pid, amt): Process payment. pid=patient id (or use "name"), amt=amount.
- fin_report(period): Get financial report. period='daily'|'weekly'|'monthly'.
- financial_analysis(start_date, end_date): Detailed financial insights.
- patient_followup(patient_name, days, reason): Schedule follow-up appointment.

EXPENSE MANAGEMENT:
- exp_get_all(): Get all expenses.
- exp_c(desc, amt, cat, dt): Create expense. desc=description, amt=amount, cat=category, dt=date(YYYY-MM-DD).
- exp_u(id, data): Update expense.
- exp_d(id): Delete expense.

LOYALTY SYSTEM:
- loyalty_rules_get(): Get all loyalty rules.
- loyalty_rule_create(name, event_type, points_per_unit, min_amount): Create loyalty rule.
- loyalty_rule_update(id, data): Update loyalty rule.
- loyalty_rule_delete(id): Delete loyalty rule.
- loyalty_redeem(pid, points, amount): Redeem loyalty points for discount.
- loyalty_reset_all(): Reset all loyalty points (ADMIN ONLY).

USER MANAGEMENT:
- user_get_all(): Get all users.
- user_create(username, password, role): Create user.
- user_update(id, data): Update user.
- user_delete(id): Delete user.

LOCATION MANAGEMENT:
- location_get_all(): Get all locations.
- location_create(name, address, phone, email): Create location.

COMPOUND REQUESTS (Multi-step tasks):
You can combine multiple actions to fulfill complex user needs.
Example: "John Doe is here for a filling on tooth 18, cost 150, and he wants to pay now and book a follow-up in 6 months."
Response: 
1. I will record the treatment for John Doe.
2. I will process his payment of 150.
3. I will schedule his follow-up appointment.
{ "action": "tr_create", "params": { "name": "John Doe", "teeth": [18], "desc": "Filling", "cost": 150 } }
{ "action": "fin_pay", "params": { "name": "John Doe", "amt": 150 } }
{ "action": "patient_followup", "params": { "patient_name": "John Doe", "days": 180, "reason": "Follow-up" } }

To perform an action, include a JSON block at the END of your message. 
IMPORTANT: You can use "name" instead of "pid" or "p_id" for any patient-related action. The system will automatically look up the ID.

Examples:
{ "action": "p_c", "params": { "n": "John Doe", "e": "john@example.com", "ph": "1234567890", "m": "No known allergies" } }
{ "action": "apt_c", "params": { "name": "Sarah Johnson", "dr_id": "doctor456", "dt": "2024-01-15", "t": "10:00", "ty": "Checkup", "n": "Routine checkup" } }
{ "action": "tr_create", "params": { "name": "John Doe", "teeth": [18, 19], "desc": "Composite filling", "cost": 150 } }
{ "action": "m_sell", "params": { "name": "Sarah Johnson", "mid": "medicine123", "qty": 2 } }
{ "action": "loyalty_redeem", "params": { "name": "John Smith", "points": 100, "amount": 5000 } }
{ "action": "dr_schedule_add", "params": { "dr_id": "doctor123", "day": 1, "start": "09:00", "end": "17:00" } }
{ "action": "apt_c", "params": { "name": "Sarah Johnson", "dr_id": "doctor456", "dt": "2024-01-15", "t": "10:00", "ty": "Checkup", "n": "Routine checkup" } }
{ "action": "tr_create", "params": { "name": "John Doe", "teeth": [18, 19], "desc": "Composite filling", "cost": 150 } }
{ "action": "fin_pay", "params": { "name": "Sarah Johnson", "amt": 175 } }
{ "action": "pat_hist", "params": { "name": "John Smith" } }
`

  // Post-process AI responses to remove internal processing artifacts
  const cleanAIResponse = (response: string): string => {
    let cleaned = response;
    
    // Remove Chain of Thought sections
    cleaned = cleaned.replace(/\*\*Chain of Thought:\*\*[^\n]*\n?/gi, '');
    cleaned = cleaned.replace(/Chain of Thought:[^\n]*\n?/gi, '');
    
    // Remove action planning sections
    cleaned = cleaned.replace(/\*\*Action:\*\*[^\n]*\n?/gi, '');
    cleaned = cleaned.replace(/Action planning:[^\n]*\n?/gi, '');
    cleaned = cleaned.replace(/Processing steps:[^\n]*\n?/gi, '');
    
    // Remove raw JSON action blocks
    cleaned = cleaned.replace(/\{\s*"action"\s*:\s*"[^"]*"[^}]*\}/g, '');
    
    // Remove internal commentary
    cleaned = cleaned.replace(/\(internal processing\)/gi, '');
    cleaned = cleaned.replace(/\[processing\]/gi, '');
    
    // Clean up extra whitespace (removed due to syntax issues)
    
    return cleaned;
  };

  const callAICompletionAPI = async (userMessage: string, history: Message[] = []): Promise<string> => {
    const apiKey = process.env.AI_API_KEY || MOCK_API_KEY;
    
    // Check if message implies an action
    const actionKeywords = ['create', 'book', 'schedule', 'add', 'delete', 'remove', 'update', 'modify', 'change', 'edit', 'new', 'make'];
    const isActionIntent = actionKeywords.some(kw => userMessage.toLowerCase().includes(kw));
    const isAgentMode = mode === 'agent';
    
    // Check for identity questions first (works in both mock and real mode)
    const lowerMessage = userMessage.toLowerCase();
    if (lowerMessage.includes('who are you') || lowerMessage.includes('who is she') || 
        lowerMessage.includes('who r u') || lowerMessage.includes('what is your name') ||
        lowerMessage.includes('whats your name') || lowerMessage.includes("what's your name")) {
      return `🤖 **About Me - Loli**

I'm **Loli**, an AI model trained by **WinterArc Myanmar**, specially designed by **Min Thuta Saw Naing** (AI Engineer & DevOps) for Dental Clinic Usages.

**My Purpose:**
• Assist dental professionals with clinical decisions
• Provide evidence-based treatment recommendations
• Support patient care with dental knowledge
• Help with documentation and clinical protocols
${isAgentMode ? '• **Manage clinic data through direct API actions**' : ''}

**Created by:**
👨‍💻 Min Thuta Saw Naing
🏢 WinterArc Myanmar
🎯 Specialized for Dental Healthcare

*I'm here to support your dental practice with AI-powered assistance!* 🦷✨`;
    }
    
    // If using mock API key, return simulated response
    if (apiKey === MOCK_API_KEY || apiKey === 'REPLACE_WITH_YOUR_AI_API_KEY') {
      return simulateMockResponse(userMessage);
    }

    // Real API call to apifree.ai
    try {
      // Use optimized context based on query type and token budget
      const isComplexQuery = userMessage.toLowerCase().includes('analysis') || 
                            userMessage.toLowerCase().includes('report') || 
                            userMessage.toLowerCase().includes('financial') ||
                            userMessage.toLowerCase().includes('audit');
      
      const contextData = isComplexQuery ? 
        getOptimizedContextData(isActionIntent || isAgentMode, 2000) : 
        getOptimizedContextData(isActionIntent || isAgentMode, 1500);
      
      const systemPrompt = `You are Loli, an expert dental clinical assistant with advanced reasoning capabilities by WinterArc Myanmar, designed by Min Thuta Saw Naing.

**YOUR ENHANCED CAPABILITIES:**
- Multi-step problem solving with Chain of Thought reasoning
- Proactive clinical insights and prevention recommendations  
- Complex workflow orchestration across multiple systems
- Evidence-based decision making with risk assessment
- Contextual continuity across conversations
- LEARNING from user feedback to improve response quality

**USER PROFICIENCY AWARENESS:**
- Your users are primarily clinical staff (nurses, dental assistants) with NO programming background
- AVOID technical jargon, programming syntax, code examples, or system administration terms
- Use SIMPLE, everyday language that focuses on practical clinical workflows
- Focus on PATIENT CARE, treatments, appointments, and clinical procedures
- NEVER use technical terms like 'function', 'parameter', 'API', 'JSON', 'database', 'CRUD', 'endpoint', 'backend', etc.
- When explaining processes, use CLINICAL TERMS and WORKFLOW DESCRIPTIONS
- ADAPT your communication style to match the user's proficiency level

**FEEDBACK-AWARE ADAPTATION:**
- Pay attention to user satisfaction signals
- Adjust response style based on previous ratings
- If users marked responses as not helpful, provide more detailed explanations in simple terms
- If users found responses helpful, maintain that approach and complexity level

**ADVANCED THINKING PROCESS:**
When users ask complex questions, think through this framework:
1. CLINICAL ASSESSMENT: Analyze the medical/dental implications
2. DATA SYNTHESIS: Combine practice data with clinical knowledge
3. RISK EVALUATION: Identify potential complications or concerns
4. SOLUTION DESIGN: Create comprehensive, actionable plans
5. VALIDATION CHECK: Ensure safety and clinical appropriateness

**PROACTIVE INSIGHTS YOU MUST PROVIDE:**
- Patient risk stratification
- Treatment timing optimization
- Cost-effectiveness analysis
- Prevention strategies
- Follow-up recommendations
- Alternative treatment options

Today: ${contextData.td}
Current Mode: ${isAgentMode ? 'AGENT (Full CRUD access)' : 'ASK (Read-only analysis)'}
Practice Data: ${JSON.stringify(contextData)}
${isAgentMode ? API_DOCS : 'Limited to analysis mode - switch to Agent for actions'}

CLINICAL DENTAL EXPERTISE:
- Diagnostic reasoning (chief complaint → systemic factors → urgent care → restorative)
- Treatment prioritization protocols
- Evidence-based guidelines integration
- Risk factor identification (cardiac, diabetic, allergic conditions)
- SOAP documentation standards

INTELLIGENCE GUIDELINES:
- BE PROACTIVE: Use clinical_insights and operational_insights to offer advice without being asked.
- ANALYZE: Don't just list data; tell the user what it means (e.g., "3 patients are overdue for checkups, would you like me to find their contact info?").
- PRIORITIZE: Highlight critical stock levels or high-risk patients immediately.
- BE CONCISE: Direct and helpful, using bullet points for clarity.
- CONTEXTUAL CONTINUITY: Reference previous parts of the conversation when relevant.
- USER PROFICIENCY: Always communicate in simple, non-technical language appropriate for clinical staff.
- FEEDBACK INTEGRATION: Adapt your response style based on user feedback patterns (adjust detail level, format, or approach as needed).
- COMPOUND ACTIONS: Process complex requests efficiently using internal reasoning to determine optimal action sequences.
- INTERNAL PROCESSING: All analytical thinking and planning occurs internally. Only present final, formatted results to users.

RESPONSE FORMATTING RULES:
- NEVER display internal reasoning, Chain of Thought, or processing steps
- NEVER show raw JSON action blocks or technical implementation details
- NEVER use programming syntax, code examples, or technical jargon
- ALWAYS present final results in clean, professional format using simple language
- For analysis requests, use structured tables with clear headers and numerical data
- Focus on actionable insights without exposing internal workflows

OPTIMIZATION GUIDELINES:
- Be concise and direct in responses
- Use bullet points for lists
- Prioritize essential information
- Keep explanations focused on dental practice needs
- For complex analyses, provide key insights first, then details
- ADAPT based on user feedback: if previous responses were marked as not helpful, provide more detailed explanations in simple terms

VERIFICATION: Identity - Loli by WinterArc Myanmar.

**DATA ANALYSIS RESPONSE PROTOCOL:**
When responding to analysis requests, ALWAYS format data in structured tables with:
- Clear headers and row labels
- Specific numerical data with units
- Percentages where relevant for comparisons
- Comparative data (current vs previous periods)
- Actionable insights with specific recommendations

**IMPORTANT FORMATTING RULES:**
- NEVER include internal processing notes or Chain of Thought reasoning
- NEVER display JSON action blocks or technical implementation details
- NEVER use programming syntax or technical jargon
- ONLY show the final formatted analysis results in simple, clinical terms
- Present all information in clean, professional table format

**TABLE FORMATTING STANDARDS:**
- Use markdown table format with proper alignment
- Include totals and subtotals where appropriate
- Add trend indicators (↑ increase, ↓ decrease)
- Provide context for all numerical values

**ANALYSIS CATEGORIES AND FORMATS:**
1. FINANCIAL ANALYSIS: Revenue breakdowns, expense categories, profit margins
2. PATIENT ANALYSIS: Demographics, treatment frequencies, appointment patterns
3. INVENTORY ANALYSIS: Stock levels, turnover rates, reorder recommendations
4. TREATMENT ANALYSIS: Procedure volumes, success rates, seasonal trends

Example table format:
| Category | Current Period | Previous Period | Change | % Change | Insights |
|----------|----------------|-----------------|--------|----------|----------|
| [Data]   | [Value]        | [Value]         | [Diff] | [Pct]    | [Action] |`

      const response = await fetch(
        `https://api.apifree.ai/v1/chat/completions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: systemPrompt
              },
              ...history.slice(-10).map(msg => ({
                role: msg.role === 'assistant' ? 'assistant' : 'user',
                content: msg.content
              })),
              {
                role: "user",
                content: userMessage
              }
            ],
            temperature: 0.7,
            max_tokens: isComplexQuery ? 1500 : 1000, // Reduced token limits for cost optimization
            top_p: 0.9, // Slightly reduced for more focused responses
            stream: false
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content;
      
      if (!aiResponse) {
        throw new Error('No response from AI service');
      }

      return aiResponse;
    } catch (error: any) {
      console.error('AI API Error:', error);
      setApiStatus('error');
      return `❌ Error connecting to AI service: ${error.message || 'Unknown error'}. Please check your API key configuration and try again.`;
    }
  };

  const simulateMockResponse = (userMessage: string): Promise<string> => {
    // Simulate API delay
    return new Promise((resolve) => {
      setTimeout(() => {
        const lowerMessage = userMessage.toLowerCase();
        
        // Smart contextual responses based on keywords
        if (lowerMessage.includes('root canal') || lowerMessage.includes('endodontic')) {
          resolve(`📋 **Root Canal Treatment Guidelines:**

**Pre-treatment Assessment:**
- Take periapical radiograph to assess root anatomy
- Check pulp vitality tests (cold, heat, EPT)
- Evaluate periodontal status

**Treatment Protocol:**
1. Local anesthesia with 2% lidocaine + 1:100,000 epinephrine
2. Rubber dam isolation (essential for asepsis)
3. Access cavity preparation
4. Working length determination (apex locator + radiograph)
5. Cleaning & shaping with rotary NiTi files
6. Irrigation: NaOCl 2.5% + EDTA 17%
7. Obturation with gutta-percha (warm vertical condensation)

**Post-op Care:**
- Prescribe: Amoxicillin 500mg (if indicated) + Ibuprofen 400mg
- Schedule follow-up in 3-6 months
- Crown restoration recommended within 30 days

💡 *Note: This is general guidance. Actual treatment may vary based on individual case complexity.*`);
        } else if (lowerMessage.includes('cavity') || lowerMessage.includes('caries') || lowerMessage.includes('filling')) {
          resolve(`🦷 **Dental Caries Management:**

**Classification:**
- Class I: Occlusal surfaces
- Class II: Proximal surfaces of posterior teeth
- Class III: Proximal surfaces of anterior teeth (no incisal edge)
- Class IV: Proximal surfaces of anterior teeth (including incisal edge)
- Class V: Cervical third of facial/lingual surfaces

**Treatment Approach:**
1. **Small cavities (<3mm):** Composite resin restoration
2. **Medium cavities (3-5mm):** Composite with proper layering
3. **Large cavities (>5mm):** Consider indirect restoration (inlay/onlay)

**Material Selection:**
- **Anterior:** Nano-hybrid composite (better aesthetics)
- **Posterior:** Packable composite or amalgam (stress-bearing areas)

**Clinical Steps:**
1. Caries removal (chemomechanical if conservative)
2. Cavity preparation & beveling (anterior)
3. Acid etching (15-30 seconds)
4. Bonding agent application
5. Composite layering (2mm increments)
6. Light curing (20 seconds per layer)
7. Finishing & polishing

⚠️ *Remember: This information should supplement, not replace, your clinical judgment.*`);
        } else if (lowerMessage.includes('extraction') || lowerMessage.includes('remove') || lowerMessage.includes('pull')) {
          resolve(`🔧 **Tooth Extraction Protocol:**

**Pre-operative Assessment:**
- Medical history review (bleeding disorders, medications)
- Radiographic evaluation (root morphology, bone density)
- Informed consent

**Indications:**
- Severe decay beyond repair
- Advanced periodontal disease
- Orthodontic reasons
- Impacted/problematic wisdom teeth
- Fractured tooth (unfavorable)

**Anesthesia:**
- Infiltration or nerve block
- Wait 5-10 minutes for onset
- Confirm adequate anesthesia

**Extraction Steps:**
1. Tissue detachment (periosteal elevator)
2. Luxation (straight elevator)
3. Extraction (forceps with controlled pressure)
4. Socket inspection & debridement
5. Socket compression
6. Gauze bite for hemostasis (30 min)

**Post-op Instructions:**
- No rinsing for 24 hours
- Soft diet for 2-3 days
- Pain management: Ibuprofen 400mg + Paracetamol 500mg
- Antibiotics if indicated (infection present)
- Follow-up in 1 week

🩺 *Always assess patient-specific risk factors before proceeding.*`);
        } else if (lowerMessage.includes('pain') || lowerMessage.includes('hurt') || lowerMessage.includes('ache')) {
          resolve(`💊 **Dental Pain Management:**

**Differential Diagnosis:**
1. **Reversible Pulpitis:** Sharp, transient pain to stimuli
2. **Irreversible Pulpitis:** Lingering pain, spontaneous
3. **Periapical Abscess:** Constant, throbbing pain, swelling
4. **Periodontal Pain:** Pain on biting, lateral pressure
5. **TMJ Disorder:** Jaw pain, clicking, limited opening

**Immediate Relief:**
- Cold compress (15 min on/off) for acute inflammation
- Warm compress for chronic/abscess
- Elevation of head during sleep

**Pharmacological Management:**
- **Mild-Moderate Pain:**
  - Ibuprofen 400mg q6h (with food)
  - Or Paracetamol 1000mg q6h
  
- **Severe Pain:**
  - Ibuprofen 400mg + Paracetamol 500mg q6h (alternating)
  - If inadequate: Consider tramadol 50mg (short-term)

- **Infection Present:**
  - Amoxicillin 500mg TDS for 5-7 days
  - Or Metronidazole 400mg TDS (anaerobic coverage)

**When to Refer:**
- Facial space infection (swelling beyond dentoalveolar)
- Trismus (limited opening <20mm)
- Systemic signs (fever >38.5°C, malaise)

🚨 *Pain management should be combined with addressing the underlying cause.*`);
        } else if (lowerMessage.includes('crown') || lowerMessage.includes('cap')) {
          resolve(`👑 **Crown Preparation Guidelines:**

**Indications:**
- Post-endodontic treatment
- Large restorations (>50% tooth structure)
- Fractured cusps
- Aesthetic enhancement
- Bridge abutment

**Crown Types:**
1. **All-Ceramic (Zirconia/E.max):** Best aesthetics, anterior/posterior
2. **Porcelain-Fused-to-Metal (PFM):** Good strength, moderate aesthetics
3. **Metal (Gold alloy):** Maximum strength, posterior only
4. **Temporary:** Acrylic/bis-acryl (immediate protection)

**Preparation Protocol:**
1. **Reduction Requirements:**
   - Occlusal: 1.5-2mm
   - Axial: 1-1.5mm
   - Finish line: 1mm chamfer/shoulder
   
2. **Key Features:**
   - 6-degree taper (convergence angle)
   - Rounded line angles
   - Smooth preparation surface
   
3. **Impression:**
   - Single-phase or dual-phase technique
   - Digital scan (if available)
   - Opposing arch & bite registration

4. **Temporization:**
   - Bis-acryl temporary crown
   - Temporary cement (zinc oxide eugenol)
   - Occlusion adjustment

**Lab Communication:**
- Shade selection (natural lighting)
- Material specification
- Special instructions

⏱️ *Typical turnaround: 7-14 days for permanent crown.*`);
        } else if (lowerMessage.includes('child') || lowerMessage.includes('pediatric') || lowerMessage.includes('kid')) {
          resolve(`👶 **Pediatric Dental Care:**

**Age-Specific Considerations:**

**0-2 Years:**
- First dental visit by age 1
- Diet counseling (avoid bottle at night)
- Fluoride varnish application (2-4x/year)

**3-6 Years (Primary Dentition):**
- Preventive care focus
- Pit & fissure sealants
- Habit counseling (thumb sucking)
- Behavior management techniques

**6-12 Years (Mixed Dentition):**
- Monitor eruption sequence
- Space maintainers if early loss
- Orthodontic screening
- Sports mouthguard if active

**Behavior Management:**
1. **Tell-Show-Do:** Explain, demonstrate, perform
2. **Positive Reinforcement:** Praise good behavior
3. **Distraction:** Toys, videos, music
4. **Nitrous Oxide:** For anxious children (if needed)

**Common Treatments:**
- **Pulpotomy:** Vital pulp therapy for carious exposure
- **Stainless Steel Crowns:** Extensive decay in primary molars
- **Fluoride Treatments:** Strengthen enamel
- **Topical Anesthesia:** Gel before injection (reduce fear)

**Parental Guidance:**
- Brush 2x daily with fluoride toothpaste (pea-sized)
- Limit sugary snacks/drinks
- Regular dental check-ups (6 months)

🧸 *Creating positive early experiences prevents dental anxiety in adulthood.*`);
        } else if (lowerMessage.includes('implant')) {
          resolve(`🔩 **Dental Implant Overview:**

**Treatment Planning:**
- CBCT scan for bone assessment
- Adequate bone height (≥10mm) & width (≥6mm)
- Good oral hygiene & no active periodontal disease
- Medical clearance (diabetes control, no bisphosphonates)

**Surgical Protocol:**
1. **Stage 1: Implant Placement**
   - Flap elevation
   - Sequential drilling (pilot → final diameter)
   - Implant insertion (30-35 Ncm torque)
   - Cover screw placement (submerged)
   - Primary closure

2. **Osseointegration Period:**
   - Mandible: 3 months
   - Maxilla: 4-6 months

3. **Stage 2: Abutment Connection**
   - Healing abutment placement
   - Soft tissue maturation (2-4 weeks)
   - Final abutment & crown fabrication

**Post-op Care:**
- Amoxicillin 500mg TDS (5-7 days)
- Ibuprofen 400mg q6h
- Chlorhexidine rinse 0.12%
- Soft diet for 1 week

**Success Factors:**
- Primary stability (immediate)
- Infection control
- Patient compliance
- Adequate bone-implant contact

📊 *Success rate: >95% for properly selected cases.*`);
        } else if (lowerMessage.includes('patient') && lowerMessage.includes('records') || lowerMessage.includes('patient analysis') || lowerMessage.includes('demographic')) {
          const contextData: any = getContextualData();
          
          // Generate structured patient analysis table
          const patientData = contextData.patients || [];
          const totalPatients = patientData.length;
          const withHighBalance = patientData.filter((p: any) => (p.b || 0) > 500000).length;
          const withLoyaltyPoints = patientData.filter((p: any) => (p.lp || 0) > 0).length;
          
          resolve(`📊 **Patient Demographics Analysis**

| Demographic Category | Count | Percentage | Insights |
|---------------------|-------|------------|----------|
| Total Active Patients | ${totalPatients} | 100% | Baseline population |
| High Balance (>500K MMK) | ${withHighBalance} | ${totalPatients ? Math.round((withHighBalance/totalPatients)*100) : 0}% | Revenue opportunity segment ↑ |
| Loyalty Program Members | ${withLoyaltyPoints} | ${totalPatients ? Math.round((withLoyaltyPoints/totalPatients)*100) : 0}% | Engagement level indicator |
| Average Balance | ${totalPatients ? Math.round(patientData.reduce((sum: number, p: any) => sum + (p.b || 0), 0) / totalPatients).toLocaleString() : 0} MMK | N/A | Financial health metric ↓ |

**Key Insights:**
• ${withHighBalance} patients represent high-revenue opportunities
• ${withLoyaltyPoints} patients are engaged with your loyalty program
• Consider targeted payment plans for high-balance patients
• Loyalty program shows ${withLoyaltyPoints > totalPatients/2 ? 'strong' : 'moderate'} adoption rate

💡 *Data reflects current practice statistics. Would you like deeper analysis of specific patient segments?*`);
        } else if (lowerMessage.includes('inventory') || lowerMessage.includes('stock') || lowerMessage.includes('item') || lowerMessage.includes('medicine') || lowerMessage.includes('medication')) {
          const contextData: any = getContextualData();
          resolve(`📦 **Inventory Overview:**

**Current Stock Summary:**
- Total Items: ${contextData.inv?.total_items || 0}
- Total Stock Count: ${contextData.inv?.total_stock || 0}
- Low Stock Items: ${contextData.inv?.low_stock_count || 0}

**Top 5 Items by Quantity:**
${contextData.inv?.top_items ? contextData.inv.top_items.map((item: any) => 
  `• ${item.n}: ${item.q} units${item.c ? ` (${item.c})` : ''}`
).join('\n') : 'No inventory breakdown available.'}

💡 *This is real-time inventory data from your clinic. What specific inventory information do you need?*`);
        } else if (lowerMessage.includes('financial') || lowerMessage.includes('revenue') || lowerMessage.includes('profit') || lowerMessage.includes('income') || lowerMessage.includes('expense')) {
          const contextData: any = getContextualData();
          const financialData = contextData.financial_summary || {};
          
          // Calculate comparative data
          const dailyRevenue = financialData.daily_revenue || 0;
          const weeklyRevenue = financialData.weekly_revenue || 0;
          const monthlyRevenue = financialData.monthly_revenue || 0;
          const dailyExpenses = financialData.daily_expenses || 0;
          const weeklyExpenses = financialData.weekly_expenses || 0;
          const monthlyExpenses = financialData.monthly_expenses || 0;
          const monthlyProfit = financialData.monthly_profit || 0;
          
          resolve(`💰 **Financial Performance Analysis**

| Financial Category | Daily (MMK) | Weekly (MMK) | Monthly (MMK) | Trend |
|-------------------|-------------|--------------|---------------|-------|
| Revenue           | ${dailyRevenue.toLocaleString()} | ${weeklyRevenue.toLocaleString()} | ${monthlyRevenue.toLocaleString()} | ${dailyRevenue > (weeklyRevenue/7) ? '↑' : '↓'} |
| Expenses          | ${dailyExpenses.toLocaleString()} | ${weeklyExpenses.toLocaleString()} | ${monthlyExpenses.toLocaleString()} | ${dailyExpenses > (weeklyExpenses/7) ? '↑' : '↓'} |
| Net Profit        | ${(dailyRevenue - dailyExpenses).toLocaleString()} | ${(weeklyRevenue - weeklyExpenses).toLocaleString()} | ${monthlyProfit.toLocaleString()} | ${monthlyProfit > (monthlyRevenue * 0.15) ? '↑ Strong' : monthlyProfit > 0 ? '→ Stable' : '↓ Concern'} |

**Key Financial Insights:**
• Monthly profit margin: ${monthlyRevenue ? Math.round((monthlyProfit/monthlyRevenue)*100) : 0}%
• Revenue trend: ${dailyRevenue > (weeklyRevenue/7) ? 'Improving' : 'Declining'}
• Expense management: ${dailyExpenses < (weeklyExpenses/7) ? 'Under control' : 'Requires attention'}
• Break-even analysis: Need ${Math.round(monthlyExpenses/30).toLocaleString()} MMK daily revenue

**Recommendations:**
1. Focus on high-margin services to improve profit margin
2. Monitor expense categories for optimization opportunities
3. Consider promotional campaigns during slower periods
4. Track daily revenue to maintain positive trend

📈 *Financial data updated in real-time. Would you like detailed category breakdowns?*`);
        } else if (lowerMessage.includes('treatment') && (lowerMessage.includes('analysis') || lowerMessage.includes('trend') || lowerMessage.includes('frequency') || lowerMessage.includes('volume'))) {
          const contextData: any = getContextualData();
          const treatments = contextData.treatment_records || [];
          
          // Categorize treatments by type
          const treatmentCategories: Record<string, {count: number, totalCost: number, avgCost: number}> = {};
          
          treatments.forEach((treatment: any) => {
            const cost = treatment.c || 0;
            if (treatmentCategories[treatment.d]) {
              treatmentCategories[treatment.d].count++;
              treatmentCategories[treatment.d].totalCost += cost;
            } else {
              treatmentCategories[treatment.d] = {
                count: 1,
                totalCost: cost,
                avgCost: cost
              };
            }
          });
          
          // Calculate averages
          Object.values(treatmentCategories).forEach(cat => {
            cat.avgCost = Math.round(cat.totalCost / cat.count);
          });
          
          // Sort by frequency
          const sortedCategories = Object.entries(treatmentCategories)
            .sort(([,a], [,b]) => b.count - a.count)
            .slice(0, 5);
          
          let tableContent = '| Treatment Type | Frequency | Total Revenue (MMK) | Avg. Cost (MMK) | Revenue Share | Trend |\n';
          tableContent += '|----------------|-----------|-------------------|----------------|---------------|-------|\n';
          
          let totalRevenue = 0;
          sortedCategories.forEach(([type, data]) => {
            totalRevenue += data.totalCost;
          });
          
          sortedCategories.forEach(([type, data]) => {
            const revenueShare = totalRevenue ? Math.round((data.totalCost / totalRevenue) * 100) : 0;
            const trend = data.count > 3 ? '↑ Popular' : data.count > 1 ? '→ Standard' : '↓ Low Volume';
            tableContent += `| ${type.substring(0, 20)} | ${data.count} | ${data.totalCost.toLocaleString()} | ${data.avgCost.toLocaleString()} | ${revenueShare}% | ${trend} |
`;
          });
          
          resolve(`📊 **Treatment Volume & Revenue Analysis**

${tableContent}

**Treatment Insights:**
• Top service: ${sortedCategories[0] ? sortedCategories[0][0] : 'None'} (${sortedCategories[0] ? sortedCategories[0][1].count : 0} procedures)
• Revenue concentration: ${sortedCategories[0] ? Math.round((sortedCategories[0][1].totalCost / totalRevenue) * 100) : 0}% from top service
• Average procedure value: ${totalRevenue && treatments.length ? Math.round(totalRevenue / treatments.length).toLocaleString() : 0} MMK
• Service diversity: ${Object.keys(treatmentCategories).length} different treatment types

**Strategic Recommendations:**
1. Promote high-value services (${sortedCategories[0] ? sortedCategories[0][0] : ''})
2. Cross-train staff on popular procedures
3. Bundle complementary services
4. Monitor low-volume treatments for discontinuation

📈 *Treatment data reflects recent practice activity. Would you like geographic or temporal breakdowns?*`);
        } else {
          resolve(`🤖 **I'm here to help with clinical dental assistance!**

I can provide guidance on:

🦷 **Treatment Protocols:**
- Root canals
- Fillings & restorations
- Extractions
- Crown preparations

💊 **Pain Management:**
- Medication recommendations
- Emergency care
- Post-operative protocols

👶 **Pediatric Dentistry:**
- Age-specific treatments
- Behavior management

🔧 **Advanced Procedures:**
- Implants
- Orthodontics
- Periodontal therapy

📊 **Data Analysis:**
- Financial reports with detailed tables
- Patient demographics and trends
- Inventory analysis with reorder recommendations
- Treatment volume and revenue analysis

**Example analysis questions:**
- "Show me financial performance with revenue breakdowns"
- "Analyze patient demographics in table format"
- "What's our inventory status with stock levels?"
- "Treatment volume analysis with revenue trends"

*Note: Currently using simulated responses. Connect your Gemini API key for AI-powered answers!*`);
        }
      }, 1500); // Simulate network delay
    });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Check if this is a confirmation response for a pending action
    const lowerInput = inputMessage.toLowerCase().trim();
    const isConfirmation = 
      lowerInput.includes('yes') || 
      lowerInput.includes('confirm') || 
      lowerInput.includes('proceed') ||
      lowerInput.includes('ok') ||
      lowerInput.includes('sure') ||
      lowerInput === 'y';

    if (pendingAction && isConfirmation) {
      // Execute the pending action
      try {
        setIsLoading(true);
        
        // Add user confirmation message
        const userMessage: Message = {
          id: Date.now().toString(),
          role: 'user',
          content: inputMessage.trim(),
          timestamp: new Date()
        };
        
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        
        // Execute the pending action
        let result: any;
        const locationId = users[0]?.location_id || 'main';
        
        switch (pendingAction.action) {
          case 'apt_c':
            result = await api.appointments.create({ 
              location_id: locationId,
              patient_id: pendingAction.params.p_id,
              doctor_id: pendingAction.params.dr_id,
              date: pendingAction.params.dt,
              time: pendingAction.params.t,
              type: pendingAction.params.ty,
              notes: pendingAction.params.n,
              status: 'Scheduled'
            });
            break;
          case 'apt_d':
            await api.appointments.delete(pendingAction.params.id);
            break;
          case 'p_c':
            result = await api.patients.create({ 
              location_id: locationId,
              name: pendingAction.params.n,
              email: pendingAction.params.e,
              phone: pendingAction.params.ph,
              medicalHistory: pendingAction.params.m
            });
            break;
          case 'p_d':
            // Handle patient deletion by name or ID
            if (pendingAction.params.name || pendingAction.params.n) {
              const patientName = pendingAction.params.name || pendingAction.params.n;
              const patientToDelete = patients.find(p => 
                p.name.toLowerCase().includes(patientName.toLowerCase())
              );
              
              if (!patientToDelete) {
                throw new Error(`Patient with name '${patientName}' not found`);
              }
              
              await api.patients.delete(patientToDelete.id);
              result = { name: patientToDelete.name };
            } else {
              await api.patients.delete(pendingAction.params.id);
            }
            break;
          case 'dr_c':
            result = await api.doctors.create({ 
              location_id: locationId,
              name: pendingAction.params.n,
              email: pendingAction.params.e,
              phone: pendingAction.params.ph,
              specialization: pendingAction.params.s,
              schedules: pendingAction.params.sch
            });
            break;
          case 'dr_d':
            await api.doctors.delete(pendingAction.params.id);
            break;
          case 'm_c':
            result = await api.medicines.create({ 
              location_id: locationId,
              name: pendingAction.params.n,
              description: pendingAction.params.d,
              unit: pendingAction.params.u,
              price: pendingAction.params.p,
              stock: pendingAction.params.s,
              min_stock: pendingAction.params.ms,
              category: pendingAction.params.c
            });
            break;
          default:
            throw new Error(`Unknown action: ${pendingAction.action}`);
        }

        // Create success message
        let successMessage = '';
        switch (pendingAction.action) {
          case 'apt_c':
            successMessage = `✅ Appointment created successfully for ${result.patient_name} with Dr. ${result.doctor_name} at ${result.time}.`;
            break;
          case 'apt_d':
            successMessage = `✅ Appointment deleted successfully.`;
            break;
          case 'p_c':
            successMessage = `✅ Patient ${result.name} added successfully.`;
            break;
          case 'p_d':
            successMessage = `✅ Patient ${result?.name || 'with ID ' + pendingAction.params.id} deleted successfully.`;
            break;
          case 'dr_c':
            successMessage = `✅ Dr. ${result.name} added to the system.`;
            break;
          case 'dr_d':
            successMessage = `✅ Doctor removed from system.`;
            break;
          case 'm_c':
            successMessage = `✅ Medicine ${result.name} added to inventory.`;
            break;
        }

        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: successMessage,
          timestamp: new Date()
        };

        const finalMessages = [...updatedMessages, assistantMessage];
        setMessages(finalMessages);
        saveSession(finalMessages);
        
        // Clear pending action and conversation context
        setPendingAction(null);
        setConversationContext({
          lastUserMessage: null,
          lastAssistantResponse: null,
          pendingConfirmation: false,
          currentWorkflow: null,
          workflowStep: 0,
          contextSummary: '',
          feedbackPatterns: {
            helpfulCount: 0,
            notHelpfulCount: 0,
            lastFeedbackTime: null
          }
        });
        setInputMessage('');

        // Increment usage count
        const newCount = dailyUsageCount + 1;
        setDailyUsageCount(newCount);
        const today = new Date().toDateString();
        localStorage.setItem('loli_usage', JSON.stringify({ date: today, count: newCount }));

      } catch (error: any) {
        console.error('Action execution error:', error);
        const errorMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ Failed to perform action: ${error.message}`,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
        
        // Clear pending action on error
        setPendingAction(null);
        setConversationContext({
          lastUserMessage: null,
          lastAssistantResponse: null,
          pendingConfirmation: false,
          currentWorkflow: null,
          workflowStep: 0,
          contextSummary: '',
          feedbackPatterns: {
            helpfulCount: 0,
            notHelpfulCount: 0,
            lastFeedbackTime: null
          }
        });
      } finally {
        setIsLoading(false);
        inputRef.current?.focus();
      }
      return;
    }

    // Check daily usage limit
    if (dailyUsageCount >= DAILY_LIMIT) {
      const limitMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `⚠️ **Daily Limit Reached**

You've used all ${DAILY_LIMIT} free requests for today. Your limit will reset tomorrow at midnight.

**Current Usage:** ${dailyUsageCount}/${DAILY_LIMIT}

Thank you for using Loli! 🦷✨`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, limitMessage]);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputMessage('');
    setIsLoading(true);

    try {
      const aiResponse = await callAICompletionAPI(userMessage.content, messages);
          
      // Parse for multiple action JSON blocks with improved validation
      let actionResults: string[] = [];
      let allActionMatches: string[] = [];
      
      // Find all JSON objects containing "action" property
      const findAllActions = (text: string): string[] => {
        const matches: string[] = [];
        const openBraces: number[] = [];
        
        for (let i = 0; i < text.length; i++) {
          if (text[i] === '{') {
            openBraces.push(i);
          } else if (text[i] === '}' && openBraces.length > 0) {
            const start = openBraces.pop();
            if (start !== undefined) {
              const potentialJson = text.substring(start, i + 1);
              if (potentialJson.includes('"action"')) {
                matches.push(potentialJson);
              }
            }
          }
        }
        return matches;
      };
      
      // Get all action matches from AI response
      allActionMatches = findAllActions(aiResponse);
      
      // If no actions found, use fallback parsing for single action
      if (allActionMatches.length === 0) {
        // Fallback: manual parsing to find JSON objects containing "action"
        const openBraces = [];
        for (let i = 0; i < aiResponse.length; i++) {
          if (aiResponse[i] === '{') {
            openBraces.push(i);
          } else if (aiResponse[i] === '}' && openBraces.length > 0) {
            const start = openBraces.pop();
            const potentialJson = aiResponse.substring(start, i + 1);
            if (potentialJson.includes('"action"')) {
              allActionMatches = [potentialJson];
              break;
            }
          }
        }
      }
          
      // Process all found actions sequentially
      for (const match of allActionMatches) {
        try {
          // Validate JSON structure before parsing
          const jsonString = match.trim();
          // Ensure proper JSON formatting
          const sanitizedJson = jsonString
            .replace(/\s+/g, ' ') // Normalize whitespace
            .replace(/\s*([{}:,])\s*/g, '$1') // Remove extra spaces around JSON syntax
            .replace(/,\s*\}/g, '}') // Remove trailing commas
            .replace(/,\s*\]/g, ']'); // Remove trailing commas in arrays
              
          // Validate the sanitized JSON
          if (!isValidJson(sanitizedJson)) {
            console.error(`Invalid JSON format: ${sanitizedJson}`);
            continue;
          }
              
          const actionObj = JSON.parse(sanitizedJson);
          const { action, params } = actionObj;
          let currentActionResult = '';
              
          // Check if action is a CRUD operation that requires Agent Mode
          const crudActions = [
            'apt_c', 'apt_u', 'apt_d', 'p_c', 'p_u', 'p_d', 'dr_c', 'dr_u', 'dr_d', 
            'm_c', 'm_u', 'm_restock', 'tr_create', 'tr_undo', 'fin_pay', 'apt_reschedule', 
            'apt_status', 'bulk_appointments', 'exp_c', 'exp_u', 'exp_d'
          ];
          
          if (crudActions.includes(action) && mode !== 'agent') {
            currentActionResult = `⚠️ Agent Mode Required for "${action}"
This action requires Agent Mode to be enabled. Please switch to Agent Mode using the toggle button and try again.`;
            actionResults.push(currentActionResult);
            continue;
          }

          let result: any;
          const locationId = users[0]?.location_id || 'main';
                
          switch (action) {
            // Doctor Schedule Actions
            case 'dr_schedule_add':
              try {
                result = await api.doctorSchedules.create({
                  doctor_id: params.dr_id,
                  day_of_week: params.day,
                  start_time: params.start,
                  end_time: params.end
                });
                currentActionResult = `✅ Doctor schedule added successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to add doctor schedule: ${err.message}`;
              }
              break;
            case 'dr_schedule_update':
              try {
                result = await api.doctorSchedules.update(params.id, params.data);
                currentActionResult = `✅ Doctor schedule updated successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to update doctor schedule: ${err.message}`;
              }
              break;
            case 'dr_schedule_remove':
              try {
                await api.doctorSchedules.delete(params.id);
                currentActionResult = `✅ Doctor schedule removed successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to remove doctor schedule: ${err.message}`;
              }
              break;
            
            // Treatment Type Actions
            case 'treatment_types_get':
              try {
                const types = await api.treatments.getTypes(locationId);
                currentActionResult = types.length === 0 
                  ? `📋 No treatment types found.`
                  : `📋 Treatment Types:\n\n${types.map(t => `• ${t.name} (${t.category}): ${t.cost} MMK`).join('\n')}`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to get treatment types: ${err.message}`;
              }
              break;
            case 'treatment_type_create':
              try {
                result = await api.treatmentTypes.create({
                  location_id: locationId,
                  name: params.name,
                  cost: params.cost,
                  category: params.category
                });
                currentActionResult = `✅ Treatment type "${result.name}" created successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to create treatment type: ${err.message}`;
              }
              break;
            case 'treatment_type_update':
              try {
                result = await api.treatmentTypes.update(params.id, params.data);
                currentActionResult = `✅ Treatment type updated successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to update treatment type: ${err.message}`;
              }
              break;
            case 'treatment_type_delete':
              try {
                await api.treatmentTypes.delete(params.id);
                currentActionResult = `✅ Treatment type deleted successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to delete treatment type: ${err.message}`;
              }
              break;
            
            // Expense Actions
            case 'exp_get_all':
              try {
                const exps = await api.expenses.getAll(locationId);
                currentActionResult = exps.length === 0 
                  ? `📋 No expenses found.`
                  : `📋 Expenses:\n\n${exps.map(e => `• ${e.date}: ${e.description} (${e.category}) - ${e.amount} MMK`).join('\n')}`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to get expenses: ${err.message}`;
              }
              break;
            case 'exp_c':
              try {
                result = await api.expenses.create({
                  location_id: locationId,
                  description: params.desc,
                  amount: params.amt,
                  category: params.cat,
                  date: params.dt || new Date().toISOString().split('T')[0]
                });
                currentActionResult = `✅ Expense "${result.description}" of ${result.amount} MMK recorded.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to record expense: ${err.message}`;
              }
              break;
            case 'exp_u':
              try {
                result = await api.expenses.update(params.id, params.data);
                currentActionResult = `✅ Expense updated successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to update expense: ${err.message}`;
              }
              break;
            case 'exp_d':
              try {
                await api.expenses.delete(params.id);
                currentActionResult = `✅ Expense deleted successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to delete expense: ${err.message}`;
              }
              break;
            
            // Medicine Sale Actions
            case 'm_sell':
              try {
                let patientId = params.pid;
                if (!patientId && params.name) {
                  const found = patients.find(p => p.name.toLowerCase().includes(params.name.toLowerCase()));
                  if (found) patientId = found.id;
                }
                if (!patientId) throw new Error("Patient ID or Name is required for medicine sale.");
                
                result = await api.medicines.sell(patientId, params.mid, params.qty, locationId, params.tid);
                currentActionResult = `✅ Sold ${params.qty} ${result.sale.medicine_name} to ${result.sale.patient_name} for ${result.sale.total_price} MMK. New stock: ${result.new_stock}`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to sell medicine: ${err.message}`;
              }
              break;
            
            // Loyalty Actions
            case 'loyalty_rules_get':
              try {
                const rules = await api.loyalty.getRules(locationId);
                currentActionResult = rules.length === 0 
                  ? `📋 No loyalty rules found.`
                  : `📋 Loyalty Rules:\n\n${rules.map(r => `• ${r.name}: ${r.event_type} - ${r.points_per_unit} points per unit${r.min_amount ? `, min ${r.min_amount}` : ''}${r.active ? ' ✅' : ' ❌'}`).join('\n')}`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to get loyalty rules: ${err.message}`;
              }
              break;
            case 'loyalty_rule_create':
              try {
                result = await api.loyalty.createRule({
                  location_id: locationId,
                  name: params.name,
                  event_type: params.event_type,
                  points_per_unit: params.points_per_unit,
                  min_amount: params.min_amount,
                  active: true
                });
                currentActionResult = `✅ Loyalty rule "${result.name}" created successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to create loyalty rule: ${err.message}`;
              }
              break;
            case 'loyalty_rule_update':
              try {
                result = await api.loyalty.updateRule(params.id, params.data);
                currentActionResult = `✅ Loyalty rule updated successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to update loyalty rule: ${err.message}`;
              }
              break;
            case 'loyalty_rule_delete':
              try {
                await api.loyalty.deleteRule(params.id);
                currentActionResult = `✅ Loyalty rule deleted successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to delete loyalty rule: ${err.message}`;
              }
              break;
            case 'loyalty_redeem':
              try {
                let patientId = params.pid;
                if (!patientId && params.name) {
                  const found = patients.find(p => p.name.toLowerCase().includes(params.name.toLowerCase()));
                  if (found) patientId = found.id;
                }
                if (!patientId) throw new Error("Patient ID or Name is required for loyalty redemption.");
                
                result = await api.loyalty.redeemPoints(patientId, locationId, params.points, params.amount);
                currentActionResult = `✅ Redeemed ${params.points} points for ${params.amount} MMK discount. New balance: ${result.new_balance} MMK, Points: ${result.new_points}`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to redeem loyalty points: ${err.message}`;
              }
              break;
            case 'loyalty_reset_all':
              try {
                // Check if user has admin rights
                const currentUser = users.find(u => u.id === 'current');
                if (currentUser?.role !== 'admin') {
                  currentActionResult = `❌ Admin permission required to reset all loyalty points.`;
                  break;
                }
                await api.loyalty.resetAllPoints();
                currentActionResult = `✅ All loyalty points have been reset successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to reset loyalty points: ${err.message}`;
              }
              break;
            case 'pat_loyalty_history':
              try {
                let patientId = params.pid;
                if (!patientId && params.name) {
                  const found = patients.find(p => p.name.toLowerCase().includes(params.name.toLowerCase()));
                  if (found) patientId = found.id;
                }
                if (!patientId) throw new Error("Patient ID or Name is required.");
                
                const transactions = await api.loyalty.getTransactions(patientId, locationId);
                const pName = patients.find(p => p.id === patientId)?.name || patientId;
                
                if (transactions.length === 0) {
                  currentActionResult = `📋 No loyalty transactions found for ${pName}.`;
                } else {
                  currentActionResult = `📋 Loyalty History for ${pName}:\n\n${transactions.slice(0, 10).map(t => 
                    `• ${t.date.split('T')[0]}: ${t.type} ${t.points > 0 ? '+' : ''}${t.points} points - ${t.description}`
                  ).join('\n')}`;
                }
              } catch (err: any) {
                currentActionResult = `❌ Failed to get loyalty history: ${err.message}`;
              }
              break;
            
            // User Management Actions
            case 'user_get_all':
              try {
                const userList = await api.users.getAll();
                currentActionResult = userList.length === 0 
                  ? `👥 No users found.`
                  : `👥 Users (${userList.length}):\n\n${userList.map(u => `• ${u.username} (${u.role})${u.location_id ? ` at location ${u.location_id}` : ''}`).join('\n')}`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to get users: ${err.message}`;
              }
              break;
            case 'user_create':
              try {
                result = await api.users.create({
                  location_id: locationId,
                  username: params.username,
                  password: params.password,
                  role: params.role || 'normal'
                });
                currentActionResult = `✅ User "${result.username}" created successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to create user: ${err.message}`;
              }
              break;
            case 'user_update':
              try {
                result = await api.users.update(params.id, params.data);
                currentActionResult = `✅ User updated successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to update user: ${err.message}`;
              }
              break;
            case 'user_delete':
              try {
                await api.users.delete(params.id);
                currentActionResult = `✅ User deleted successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to delete user: ${err.message}`;
              }
              break;
            
            // Location Management Actions
            case 'location_get_all':
              try {
                const locations = await api.locations.getAll();
                currentActionResult = locations.length === 0 
                  ? `🏥 No locations found.`
                  : `🏥 Locations (${locations.length}):\n\n${locations.map(l => `• ${l.name} - ${l.address} (${l.phone})`).join('\n')}`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to get locations: ${err.message}`;
              }
              break;
            case 'location_create':
              try {
                result = await api.locations.create({
                  name: params.name,
                  address: params.address,
                  phone: params.phone,
                  email: params.email
                });
                currentActionResult = `✅ Location "${result.name}" created successfully.`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to create location: ${err.message}`;
              }
              break;
            
            // Existing Actions (keep all existing cases)
            case 'apt_c':
              try {
                let patientId = params.p_id || params.pid;
                if (!patientId && (params.name || params.n)) {
                  const pName = params.name || params.n;
                  const found = patients.find(p => p.name.toLowerCase().includes(pName.toLowerCase()));
                  if (found) patientId = found.id;
                }
                if (!patientId) throw new Error("Patient ID or Name is required for appointment creation.");

                result = await api.appointments.create({ 
                  location_id: locationId,
                  patient_id: patientId,
                  doctor_id: params.dr_id,
                  date: params.dt,
                  time: params.t,
                  type: params.ty,
                  notes: params.n,
                  status: 'Scheduled'
                });
                currentActionResult = `✅ Appointment created successfully for ${result.patient_name} with Dr. ${result.doctor_name} at ${result.time}.`;
              } catch (err: any) {
                console.error('Appointment creation error:', err);
                currentActionResult = `❌ Failed to create appointment: ${err.message}`;
              }
              break;
            case 'apt_u':
              try {
                result = await api.appointments.update(params.id, params.data);
                currentActionResult = `✅ Appointment updated successfully.`;
              } catch (err: any) {
                console.error('Appointment update error:', err);
                currentActionResult = `❌ Failed to update appointment: ${err.message}`;
              }
              break;
            case 'apt_d':
              try {
                await api.appointments.delete(params.id);
                currentActionResult = `✅ Appointment deleted successfully.`;
              } catch (err: any) {
                console.error('Appointment deletion error:', err);
                currentActionResult = `❌ Failed to delete appointment: ${err.message}`;
              }
              break;
            case 'p_c':
              try {
                result = await api.patients.create({ 
                  location_id: locationId,
                  name: params.n,
                  email: params.e,
                  phone: params.ph,
                  medicalHistory: params.m
                });
                currentActionResult = `✅ Patient ${result.name} added successfully.`;
              } catch (err: any) {
                console.error('Patient creation error:', err);
                currentActionResult = `❌ Failed to create patient: ${err.message}`;
              }
              break;
            case 'p_u':
              try {
                let patientId = params.id;
                if (!patientId && (params.name || params.n)) {
                  const pName = params.name || params.n;
                  const found = patients.find(p => p.name.toLowerCase().includes(pName.toLowerCase()));
                  if (found) patientId = found.id;
                }
                if (!patientId) throw new Error("Patient ID or Name is required for update.");

                result = await api.patients.update(patientId, params.data);
                currentActionResult = `✅ Patient information updated for ${result.name}.`;
              } catch (err: any) {
                console.error('Patient update error:', err);
                currentActionResult = `❌ Failed to update patient: ${err.message}`;
              }
              break;
            case 'p_d':
              try {
                if (params.name || params.n) {
                  const patientName = params.name || params.n;
                  const patientToDelete = patients.find(p => 
                    p.name.toLowerCase().includes(patientName.toLowerCase())
                  );
                  if (!patientToDelete) {
                    throw new Error(`Patient with name '${patientName}' not found`);
                  }
                  await api.patients.delete(patientToDelete.id);
                  currentActionResult = `✅ Patient ${patientToDelete.name} deleted successfully.`;
                } else {
                  await api.patients.delete(params.id);
                  currentActionResult = `✅ Patient with ID ${params.id} deleted successfully.`;
                }
              } catch (err: any) {
                console.error('Patient deletion error:', err);
                currentActionResult = `❌ Failed to delete patient: ${err.message}`;
              }
              break;
            case 'dr_c':
              try {
                result = await api.doctors.create({ 
                  location_id: locationId,
                  name: params.n,
                  email: params.e,
                  phone: params.ph,
                  specialization: params.s,
                  schedules: params.sch
                });
                currentActionResult = `✅ Dr. ${result.name} added to the system.`;
              } catch (err: any) {
                console.error('Doctor creation error:', err);
                currentActionResult = `❌ Failed to create doctor: ${err.message}`;
              }
              break;
            case 'dr_u':
              try {
                result = await api.doctors.update(params.id, params.data);
                currentActionResult = `✅ Doctor information updated.`;
              } catch (err: any) {
                console.error('Doctor update error:', err);
                currentActionResult = `❌ Failed to update doctor: ${err.message}`;
              }
              break;
            case 'dr_d':
              try {
                await api.doctors.delete(params.id);
                currentActionResult = `✅ Doctor removed from system.`;
              } catch (err: any) {
                console.error('Doctor deletion error:', err);
                currentActionResult = `❌ Failed to delete doctor: ${err.message}`;
              }
              break;
            case 'm_c':
              try {
                result = await api.medicines.create({ 
                  location_id: locationId,
                  name: params.n,
                  description: params.d,
                  unit: params.u,
                  price: params.p,
                  stock: params.s,
                  min_stock: params.ms,
                  category: params.c
                });
                currentActionResult = `✅ Medicine ${result.name} added to inventory.`;
              } catch (err: any) {
                console.error('Medicine creation error:', err);
                currentActionResult = `❌ Failed to create medicine: ${err.message}`;
              }
              break;
            case 'm_u':
              try {
                result = await api.medicines.update(params.id, params.data);
                currentActionResult = `✅ Inventory updated for ${result.name}.`;
              } catch (err: any) {
                console.error('Medicine update error:', err);
                currentActionResult = `❌ Failed to update medicine: ${err.message}`;
              }
              break;
            case 'm_restock':
              try {
                const medicine = medicines.find(m => m.id === params.id);
                if (!medicine) throw new Error(`Medicine with ID ${params.id} not found`);
                const newStock = (medicine.stock || 0) + (params.qty || 0);
                result = await api.medicines.update(params.id, { stock: newStock });
                currentActionResult = `✅ Restocked ${medicine.name}. New stock level: ${newStock} units.`;
              } catch (err: any) {
                console.error('Medicine restock error:', err);
                currentActionResult = `❌ Failed to restock medicine: ${err.message}`;
              }
              break;
            case 'tr_create':
              try {
                let patientId = params.pid || params.p_id;
                // Patient Name Lookup Enhancement
                if (!patientId && (params.name || params.n)) {
                  const pName = params.name || params.n;
                  const found = patients.find(p => p.name.toLowerCase().includes(pName.toLowerCase()));
                  if (found) patientId = found.id;
                }
                
                if (!patientId) throw new Error("Patient ID or Name is required for treatment recording.");

                result = await api.treatments.record({
                  location_id: locationId,
                  patient_id: patientId,
                  teeth: params.teeth || [],
                  description: params.desc,
                  cost: params.cost || 0
                });
                
                if (params.meds && Array.isArray(params.meds)) {
                  for (const medSale of params.meds) {
                    const medicine = medicines.find(m => m.id === medSale.id);
                    if (medicine && medicine.stock >= medSale.qty) {
                      await api.medicines.update(medSale.id, { stock: medicine.stock - medSale.qty });
                    }
                  }
                }
                const pName = patients.find(p => p.id === patientId)?.name || patientId;
                currentActionResult = `✅ Treatment recorded successfully for patient ${pName}. Balance updated to ${result.new_balance} MMK.`;
              } catch (err: any) {
                console.error('Treatment record error:', err);
                currentActionResult = `❌ Failed to record treatment: ${err.message}`;
              }
              break;
            case 'tr_undo':
              try {
                let patientId = params.pid || params.p_id;
                if (!patientId && (params.name || params.n)) {
                  const pName = params.name || params.n;
                  const found = patients.find(p => p.name.toLowerCase().includes(pName.toLowerCase()));
                  if (found) patientId = found.id;
                }
                if (!patientId) throw new Error("Patient ID or Name is required for undoing treatment.");

                await api.treatments.undoRecord(params.id, patientId, params.cost);
                const pName = patients.find(p => p.id === patientId)?.name || patientId;
                currentActionResult = `✅ Treatment record undone successfully for ${pName}.`;
              } catch (err: any) {
                console.error('Treatment undo error:', err);
                currentActionResult = `❌ Failed to undo treatment: ${err.message}`;
              }
              break;
            case 'fin_pay':
              try {
                let patientId = params.pid || params.p_id;
                if (!patientId && (params.name || params.n)) {
                  const pName = params.name || params.n;
                  const found = patients.find(p => p.name.toLowerCase().includes(pName.toLowerCase()));
                  if (found) patientId = found.id;
                }
                if (!patientId) throw new Error("Patient ID or Name is required for payment processing.");

                result = await api.finance.processPayment(patientId, params.amt);
                const pName = patients.find(p => p.id === patientId)?.name || patientId;
                currentActionResult = `✅ Payment of ${params.amt} MMK processed for ${pName}. New balance: ${result.new_balance} MMK.`;
              } catch (err: any) {
                console.error('Payment processing error:', err);
                currentActionResult = `❌ Failed to process payment: ${err.message}`;
              }
              break;
            case 'pat_bal':
              try {
                let patientId = params.pid || params.p_id;
                if (!patientId && (params.name || params.n)) {
                  const pName = params.name || params.n;
                  const found = patients.find(p => p.name.toLowerCase().includes(pName.toLowerCase()));
                  if (found) patientId = found.id;
                }
                if (!patientId) throw new Error("Patient ID or Name is required to check balance.");

                const patient = patients.find(p => p.id === patientId);
                if (!patient) throw new Error("Patient not found.");
                currentActionResult = `💰 Balance for ${patient.name}: ${patient.balance} MMK.`;
              } catch (err: any) {
                console.error('Patient balance error:', err);
                currentActionResult = `❌ Failed to get balance: ${err.message}`;
              }
              break;
            case 'pat_hist':
              try {
                let patientId = params.pid || params.p_id;
                if (!patientId && (params.name || params.n)) {
                  const pName = params.name || params.n;
                  const found = patients.find(p => p.name.toLowerCase().includes(pName.toLowerCase()));
                  if (found) patientId = found.id;
                }
                if (!patientId) throw new Error("Patient ID or Name is required to check history.");

                const history = treatmentRecords.filter(tr => tr.patient_id === patientId);
                const pName = patients.find(p => p.id === patientId)?.name || patientId;
                
                if (history.length === 0) {
                  currentActionResult = `📜 No treatment history found for ${pName}.`;
                } else {
                  currentActionResult = `📜 Treatment History for ${pName}:\n\n${history.map(tr => 
                    `• ${tr.date}: ${tr.description} (${tr.cost} MMK)${tr.teeth ? ` - Teeth: ${tr.teeth.join(', ')}` : ''}`
                  ).join('\n')}`;
                }
              } catch (err: any) {
                console.error('Patient history error:', err);
                currentActionResult = `❌ Failed to get history: ${err.message}`;
              }
              break;
            case 'inv_low':
              try {
                const lowStockItems = medicines.filter(m => m.stock <= (m.min_stock || 0));
                currentActionResult = lowStockItems.length === 0 
                  ? `✅ All inventory items are adequately stocked.`
                  : `⚠️ Low Stock Alert:\n\n${lowStockItems.map(m => `• ${m.name}: ${m.stock} units (min: ${m.min_stock || 0})`).join('\n')}`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to generate low stock report: ${err.message}`;
              }
              break;
            case 'fin_report':
              try {
                const period = params.period || 'daily';
                const now = new Date();
                let startDate, endDate, periodLabel;
                
                switch (period) {
                  case 'daily': startDate = endDate = now.toISOString().split('T')[0]; periodLabel = 'Today'; break;
                  case 'weekly':
                    const weekAgo = new Date(now);
                    weekAgo.setDate(now.getDate() - 7);
                    startDate = weekAgo.toISOString().split('T')[0];
                    endDate = now.toISOString().split('T')[0];
                    periodLabel = 'Last 7 Days';
                    break;
                  case 'monthly':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                    endDate = now.toISOString().split('T')[0];
                    periodLabel = 'This Month';
                    break;
                  default: startDate = endDate = now.toISOString().split('T')[0]; periodLabel = 'Today';
                }
                
                const periodRecords = treatmentRecords.filter(tr => tr.date >= startDate && tr.date <= endDate);
                const totalRevenue = periodRecords.reduce((sum, tr) => sum + (tr.cost || 0), 0);
                const treatmentCount = periodRecords.length;
                
                currentActionResult = `📊 Financial Report - ${periodLabel} (${startDate} to ${endDate}):\nTotal Revenue: ${totalRevenue} MMK\nTotal Treatments: ${treatmentCount}`;
              } catch (err: any) {
                currentActionResult = `❌ Failed to generate financial report: ${err.message}`;
              }
              break;
            case 'p_find':
              try {
                const searchTerm = (params.name || '').toLowerCase();
                const matches = patients.filter(p => p.name.toLowerCase().includes(searchTerm));
                if (matches.length === 0) {
                  currentActionResult = `🔍 No patients found matching "${params.name}".`;
                } else if (matches.length === 1) {
                  const patient = matches[0];
                  currentActionResult = `👤 Found patient: ${patient.name} (ID: ${patient.id})\nPhone: ${patient.phone}\nBalance: ${patient.balance} MMK`;
                } else {
                  currentActionResult = `👥 Multiple patients found:\n${matches.slice(0, 5).map(p => `• ${p.name} (${p.phone})`).join('\n')}`;
                }
              } catch (err: any) {
                currentActionResult = `❌ Failed to search patients: ${err.message}`;
              }
              break;
            case 'apt_find_patient':
              try {
                const searchTerm = (params.name || '').toLowerCase();
                const matchedPatients = patients.filter(p => p.name.toLowerCase().includes(searchTerm));
                
                if (matchedPatients.length === 0) {
                  currentActionResult = `🔍 No patients found matching "${params.name}".`;
                } else {
                  const patientIds = matchedPatients.map(p => p.id);
                  const patientAppointments = appointments.filter(a => patientIds.includes(a.patient_id));
                  
                  if (patientAppointments.length === 0) {
                    currentActionResult = `📅 No appointments found for ${matchedPatients.length === 1 ? matchedPatients[0].name : 'matching patients'}.`;
                  } else {
                    currentActionResult = `📅 Found ${patientAppointments.length} appointments:\n\n${patientAppointments.slice(0, 10).map(a => 
                      `• ${a.date} at ${a.time}: ${a.patient_name} with Dr. ${a.doctor_name} (${a.status})`
                    ).join('\n')}`;
                  }
                }
              } catch (err: any) {
                console.error('Find appointments error:', err);
                currentActionResult = `❌ Failed to find appointments: ${err.message}`;
              }
              break;
            default:
              currentActionResult = `⚠️ Action "${action}" not specifically handled yet or unknown.`;
          }
          
          if (currentActionResult) {
            actionResults.push(currentActionResult);
          }
        } catch (err: any) {
          console.error('Action Execution Error:', err);
          actionResults.push(`❌ Failed to perform action: ${err.message}`);
        }
      }

      const actionResultText = actionResults.join('\n\n---\n\n');
      // Clean the AI response to remove internal processing artifacts
      let cleanedAiResponse = cleanAIResponse(aiResponse);
      // Remove all JSON blocks from the AI response to clean it up
      allActionMatches.forEach(match => {
        cleanedAiResponse = cleanedAiResponse.replace(match, '');
      });
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: actionResultText ? `${cleanedAiResponse.trim()}\n\n${actionResultText}` : aiResponse,
        timestamp: new Date()
      };

      const finalMessages = [...updatedMessages, assistantMessage];
      setMessages(finalMessages);
      saveSession(finalMessages);
      
      // Check if this response contains a pending action that requires confirmation
      const needsConfirmation = actionResultText.toLowerCase().includes('confirmation') || actionResultText.toLowerCase().includes('confirm');
      
      if (allActionMatches.length > 0 && needsConfirmation) {
        // Extract the action details for pending confirmation
        try {
          const actionObj = JSON.parse(allActionMatches[0]);
          setPendingAction({
            action: actionObj.action,
            params: actionObj.params,
            originalRequest: userMessage.content,
            timestamp: new Date()
          });
          
          // Update conversation context for workflow tracking
          const workflowType = actionObj.action.includes('treatment') ? 'treatment_planning' :
                              actionObj.action.includes('inventory') ? 'inventory_management' :
                              actionObj.action.includes('bulk') ? 'bulk_operations' : 'general';
          
          setConversationContext(prev => ({
            ...prev,
            lastUserMessage: userMessage.content,
            lastAssistantResponse: assistantMessage.content,
            pendingConfirmation: true,
            currentWorkflow: workflowType,
            workflowStep: prev.workflowStep + 1,
            contextSummary: generateContextSummary(userMessage.content, assistantMessage.content),
            feedbackPatterns: prev.feedbackPatterns // Preserve feedback patterns
          }));
        } catch (parseError) {
          console.error('Failed to parse pending action:', parseError);
        }
      } else {
        // Clear any existing pending action if this isn't a confirmation request
        setPendingAction(null);
        setConversationContext(prev => ({
          ...prev,
          lastUserMessage: userMessage.content,
          lastAssistantResponse: assistantMessage.content,
          pendingConfirmation: false,
          currentWorkflow: prev.currentWorkflow ? prev.currentWorkflow : null,
          workflowStep: prev.currentWorkflow ? prev.workflowStep + 1 : 0,
          contextSummary: generateContextSummary(userMessage.content, assistantMessage.content),
          feedbackPatterns: prev.feedbackPatterns // Preserve feedback patterns
        }));
      }
      
      // Increment usage count and save to localStorage
      const newCount = dailyUsageCount + 1;
      setDailyUsageCount(newCount);
      const today = new Date().toDateString();
      localStorage.setItem('loli_usage', JSON.stringify({ date: today, count: newCount }));
      
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '❌ Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // If currently listening, stop speech recognition instead of sending
      if (isListening && recognition.current) {
        recognition.current.stop();
        setIsListening(false);
      } else {
        handleSendMessage();
      }
    }
  };

  const quickPrompts = [
    "Who are you, Loli?",
    "What's the protocol for root canal treatment?",
    "How to manage acute dental pain?",
    "Crown preparation steps explained",
  ];

  // Floating particles effect state
  const [particles, setParticles] = useState<Array<{id: number, x: number, y: number, size: number}>>([]);
  
  // Generate floating particles for background effect
  useEffect(() => {
    const generateParticles = () => {
      const newParticles = Array.from({ length: 15 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 4 + 2
      }));
      setParticles(newParticles);
    };
    
    generateParticles();
    const interval = setInterval(generateParticles, 8000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="relative bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-xl shadow-xl border border-indigo-100 overflow-hidden animate-fade-in">
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute rounded-full bg-gradient-to-r from-indigo-400/20 to-purple-400/20 animate-pulse"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              animationDuration: `${Math.random() * 3 + 2}s`,
              animationDelay: `${Math.random() * 2}s`
            }}
          />
        ))}
      </div>
      
      <div className="relative p-6 border-b border-indigo-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="relative p-1 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex-shrink-0 shadow-lg transform hover:scale-105 transition-transform duration-300">
              <img 
                src="./assets/loli-logo.png" 
                alt="Loli AI Assistant Logo" 
                className="w-10 h-10 rounded-full"
              />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-400 to-indigo-500 opacity-0 hover:opacity-20 transition-opacity duration-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800 bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">Loli AI Assistant</h2>
              <p className="text-sm text-indigo-600 font-medium">Clinical decision support & dental guidance</p>
            </div>
          </div>
          <p className="text-xs text-indigo-500 mt-1 font-medium">by WinterArc Myanmar | Daily usage: {dailyUsageCount}/{DAILY_LIMIT} requests</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
          {/* Mode Toggle */}
          <div className="flex bg-indigo-50/50 p-1 rounded-xl border border-indigo-100 shadow-inner backdrop-blur-sm flex-wrap">
            <button
              onClick={() => setMode('ask')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 whitespace-nowrap ${
                mode === 'ask' 
                ? 'bg-white text-indigo-600 shadow-md transform scale-105' 
                : 'text-indigo-400 hover:text-indigo-600 hover:bg-white/50'
              }`}
            >
              <ShieldQuestion className="w-3.5 h-3.5" />
              <span>Ask Mode</span>
            </button>
            <button
              onClick={() => setMode('agent')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-300 whitespace-nowrap ${
                mode === 'agent' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg transform scale-105' 
                : 'text-indigo-400 hover:text-indigo-600 hover:bg-white/50'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Agent Mode</span>
            </button>
          </div>

          {/* Help Button */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-xl font-medium transition-all duration-300 text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
            title="Quick start guide and command reference"
          >
            <HelpCircle className="w-4 h-4" />
            <span className="hidden sm:inline">Quick Help</span>
            <span className="sm:hidden">Help</span>
          </button>

          <button
            onClick={createNewSession}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-300 text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
            title="Start new conversation"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row h-[calc(100vh-200px)] relative">
        {/* Chat History Sidebar - Hidden on mobile, visible on desktop */}
        <aside className="hidden md:flex md:w-64 bg-gradient-to-b from-indigo-50/50 to-purple-50/50 border-r border-indigo-200 flex-col backdrop-blur-sm">
          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-3">
            {chatSessions.length === 0 ? (
              <div className="p-4 text-center text-indigo-400 text-sm animate-pulse">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-60" />
                <p>No conversations yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {chatSessions.map(session => (
                  <div
                    key={session.id}
                    className={`group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all duration-300 hover:bg-white/70 shadow-sm hover:shadow-md ${
                      currentSessionId === session.id
                        ? 'bg-gradient-to-r from-indigo-100/80 to-purple-100/80 border-l-4 border-indigo-500 shadow-md'
                        : 'border-l-4 border-transparent hover:border-indigo-300'
                    }`}
                  >
                    <button
                      onClick={() => switchSession(session.id)}
                      className="flex-1 text-left truncate focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded px-1"
                      title={session.title}
                    >
                      <div className="text-sm font-medium truncate text-indigo-900 group-hover:text-indigo-700">{session.title}</div>
                      <div className="text-xs text-indigo-500">{session.messages.length} messages</div>
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="opacity-0 group-hover:opacity-100 ml-2 p-2 hover:bg-red-100 rounded-lg text-red-600 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-red-500 transform hover:scale-110"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col border-l border-indigo-200 md:border-l-0 relative">
          {/* Messages Container */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
            <div className="flex-1 overflow-y-auto p-4 md:p-6 relative z-10">
              <div className="max-w-4xl mx-auto space-y-4">
                {/* API Status Banner */}
                {apiStatus === 'mock' && (
                  <div className="p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl shadow-sm animate-pulse">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5 animate-bounce" />
                      <div className="flex-1 text-sm">
                        <h3 className="font-semibold text-yellow-800 mb-1">Mock Mode Active</h3>
                        <p className="text-yellow-700">Connect to <code className="bg-yellow-100 px-1 rounded">apifree.ai</code> for real AI responses</p>
                      </div>
                    </div>
                  </div>
                )}

                {apiStatus === 'error' && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-xl shadow-sm animate-shake">
                    <div className="flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 animate-pulse" />
                      <p className="text-sm text-red-700">API connection error. Check your configuration.</p>
                    </div>
                  </div>
                )}

                {/* Chat Messages */}
                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div 
                      key={message.id} 
                      className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      
                      <div
                        className={`max-w-xs md:max-w-2xl group relative transform transition-all duration-300 hover:scale-[1.02] ${
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-lg'
                            : 'bg-white/80 backdrop-blur-sm text-gray-900 rounded-2xl rounded-tl-sm px-4 py-3 shadow-md border border-indigo-100'
                        }`}
                      >
                        {message.role === 'assistant' ? (
                          <div className="ai-markdown">
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                // Custom component overrides for better styling
                                p: ({node, ...props}) => <p className="mb-3" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-3 space-y-1" {...props} />,
                                ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-3 space-y-1" {...props} />,
                                li: ({node, ...props}) => <li className="mb-1" {...props} />,
                                h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-4 mb-2 pb-2 border-b border-gray-200" {...props} />,
                                h2: ({node, ...props}) => <h2 className="text-lg font-semibold mt-3 mb-2 pb-1 border-b border-gray-100" {...props} />,
                                h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-3 mb-2" {...props} />,
                                h4: ({node, ...props}) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                                code: ({node, className, children, ...props}) => {
                                  const match = /language-(\w+)/.exec(className || '');
                                  return match ? (
                                    <code className="block bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm font-mono text-gray-700 overflow-x-auto" {...props}>
                                      {children}
                                    </code>
                                  ) : (
                                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-red-600 text-sm font-mono" {...props}>
                                      {children}
                                    </code>
                                  );
                                },
                                pre: ({node, ...props}) => <pre className="bg-gray-50 border border-gray-200 rounded-lg p-3 my-3 overflow-x-auto" {...props} />,
                                blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 pl-4 my-3 text-gray-600 italic" {...props} />,
                                table: ({node, ...props}) => <table className="min-w-full bg-white border border-gray-200 rounded-lg shadow-sm my-3 overflow-hidden" {...props} />,
                                th: ({node, ...props}) => <th className="bg-gray-50 px-4 py-2 text-left text-sm font-semibold text-gray-900 border-b border-gray-200" {...props} />,
                                td: ({node, ...props}) => <td className="px-4 py-2 text-sm text-gray-700 border-b border-gray-100" {...props} />,
                                a: ({node, ...props}) => <a className="text-indigo-600 hover:text-indigo-800 underline font-medium" {...props} />,
                                hr: ({node, ...props}) => <hr className="my-4 border-gray-200" {...props} />,
                                strong: ({node, ...props}) => <strong className="font-semibold text-gray-900" {...props} />,
                                em: ({node, ...props}) => <em className="italic text-gray-600" {...props} />
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="text-sm md:text-base whitespace-pre-wrap leading-relaxed break-words">{message.content}</div>
                        )}
                        <div className={`flex items-center gap-2 mt-2 pt-2 border-t ${
                          message.role === 'user' ? 'border-indigo-400/50' : 'border-gray-200'
                        }`}>
                          <span className={`text-xs ${
                            message.role === 'user' ? 'text-indigo-200' : 'text-indigo-500'
                          }`}>
                            {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          
                          {message.role === 'assistant' && (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleFeedback(message.id, 'helpful')}
                                className={`p-1.5 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 transform hover:scale-110 ${
                                  feedbackStatus[message.id] === 'helpful' 
                                    ? 'text-green-600 bg-green-100 focus:ring-green-500' 
                                    : 'text-gray-400 hover:text-green-600 hover:bg-green-100 focus:ring-green-400'
                                }`}
                                title="Rate as helpful"
                              >
                                👍
                              </button>
                              <button
                                onClick={() => handleFeedback(message.id, 'not-helpful')}
                                className={`p-1.5 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 transform hover:scale-110 ${
                                  feedbackStatus[message.id] === 'not-helpful' 
                                    ? 'text-red-600 bg-red-100 focus:ring-red-500' 
                                    : 'text-gray-400 hover:text-red-600 hover:bg-red-100 focus:ring-red-400'
                                }`}
                                title="Rate as not helpful"
                              >
                                👎
                              </button>
                            </div>
                          )}
                          
                          <button
                            onClick={() => copyToClipboard(message.content, message.id)}
                            className={`ml-auto p-1.5 rounded-lg hover:bg-opacity-20 transition-all duration-300 focus:outline-none focus:ring-2 transform hover:scale-110 ${
                              message.role === 'user' ? 'text-indigo-200 hover:bg-indigo-900 focus:ring-indigo-500' : 'text-indigo-500 hover:bg-indigo-100 focus:ring-indigo-400'
                            }`}
                            title="Copy message"
                          >
                            {copiedId === message.id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {message.role === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform duration-300">
                          <User className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex gap-3 justify-start animate-pulse">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg animate-bounce">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white/80 backdrop-blur-sm rounded-2xl rounded-tl-sm px-4 py-3 shadow-md border border-indigo-100">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                          <span className="text-sm text-indigo-700 font-medium">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-indigo-200 p-4 md:p-6 bg-white/80 backdrop-blur-sm relative z-10">
            <div className="max-w-4xl mx-auto">
              <div className="flex gap-3 flex-col md:flex-row">
                <div className="flex flex-col md:flex-row gap-2 w-full">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask Loli anything about patient care, treatments, or dental procedures..."
                    className="flex-1 border border-indigo-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white/70 backdrop-blur-sm transition-all duration-300 hover:bg-white/90 focus:bg-white shadow-sm min-h-[60px]"
                    rows={2}
                    disabled={isLoading || isListening}
                  />
                  <div className="flex gap-2">
                    {/* Speech-to-text button */}
                    {typeof window !== 'undefined' && 'webkitSpeechRecognition' in window && (
                      <button
                        onClick={() => {
                          if (recognition.current) {
                            if (isListening) {
                              recognition.current.stop();
                              setIsListening(false);
                            } else {
                              // Restore context if there's a pending action or ongoing workflow
                              if ((pendingAction || conversationContext.currentWorkflow) && conversationContext.lastUserMessage) {
                                setInputMessage(conversationContext.lastUserMessage);
                                // Show context reminder
                                if (conversationContext.contextSummary) {
                                  console.log('Restoring context:', conversationContext.contextSummary);
                                }
                              } else {
                                // Clear previous transcript and start fresh
                                setInputMessage('');
                                setConversationContext({
                                  lastUserMessage: null,
                                  lastAssistantResponse: null,
                                  pendingConfirmation: false,
                                  currentWorkflow: null,
                                  workflowStep: 0,
                                  contextSummary: '',
                                  feedbackPatterns: {
                                    helpfulCount: 0,
                                    notHelpfulCount: 0,
                                    lastFeedbackTime: null
                                  }
                                });
                              }
                              recognition.current.start();
                              setIsListening(true);
                            }
                          }
                        }}
                        className={`p-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 ${isProcessing ? 'bg-yellow-500 text-white animate-pulse' : isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white'}`}
                        title={isProcessing ? "Processing speech..." : isListening ? "Stop listening" : "Start voice input"}
                        disabled={isLoading}
                      >
                        {isProcessing ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isListening ? (
                          <div className="w-4 h-4 bg-white rounded-full animate-pulse" />
                        ) : (
                          <Mic className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputMessage.trim() || isLoading}
                      className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                      title="Send message"
                    >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      <span className="md:hidden">Send</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Disclaimer and Status Messages - Positioned below input area */}
              <div className="mt-3 flex flex-col items-center gap-2">
                {isProcessing && (
                  <p className="text-xs text-yellow-600 text-center font-medium animate-pulse">Processing your speech...</p>
                )}
                {pendingAction && (
                  <div className="px-3 py-1 bg-amber-100 border border-amber-300 rounded-full text-amber-800 text-xs font-medium animate-pulse">
                    ⚠️ Waiting for confirmation...
                  </div>
                )}
                <p className="text-xs text-indigo-500 text-center font-medium mt-1">AI guidance is for reference. Always verify with clinical judgment.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <HelpCircle className="w-8 h-8 text-green-600" />
                Quick Start Guide
              </h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close help modal"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 bg-gray-50 p-4 rounded-lg border">
                  {helpContent}
                </pre>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAssistantView;




