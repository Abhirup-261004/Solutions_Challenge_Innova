import { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, LoaderCircle, MessageSquare, Send, Sparkles, User, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { roleDefinitions, useAuth } from '../contexts/AuthContext';

const pagePromptMap = {
  '/': [
    'What does this platform do?',
    'Which page should I open next?',
    'Show the main workflows'
  ],
  '/dashboard': [
    'What are the most urgent needs right now?',
    'Which urgent needs still need volunteers?',
    'Summarize notifications and approvals'
  ],
  '/intake': [
    'How does OCR intake work here?',
    'What happens after a scan succeeds?',
    'Explain the intake workflow'
  ],
  '/approval-queue': [
    'Summarize pending approvals',
    'What should I verify before approving?',
    'Explain responsible AI review'
  ],
  '/volunteer': [
    'Explain the volunteer workflow',
    'Which volunteers look strongest right now?',
    'How should volunteers be routed?'
  ],
  '/analytics': [
    'Give me a quick platform summary',
    'Which escalations need attention first?',
    'Explain what the analytics page is showing'
  ],
  '/transparency': [
    'What should a judge notice here?',
    'Give me a quick platform summary',
    'How does this page build trust?'
  ],
  '/login': [
    'What can each role do?',
    'Which role should I use for the demo?',
    'How does sign-in work here?'
  ],
  '/register': [
    'What role should I create first?',
    'Explain the role differences',
    'What happens after registration?'
  ]
};

function createWelcomeMessage(role, pathname) {
  const pageLabel = pathname === '/' ? 'landing page' : pathname.replace('/', '');
  return {
    id: `welcome-${Date.now()}`,
    sender: 'assistant',
    text: `Operations Assistant is ready. I can explain workflows, summarize live data with concrete counts, and point you to the right module for your ${roleDefinitions[role]?.label || 'Viewer'} role from the ${pageLabel}.`,
    actions: []
  };
}

export default function OperationsChatbot() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, getToken } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [hasLoadedSummary, setHasLoadedSummary] = useState(false);
  const scrollRef = useRef(null);

  const role = currentUser?.role || 'viewer';
  const suggestedPrompts = useMemo(
    () => pagePromptMap[location.pathname] || pagePromptMap['/'],
    [location.pathname]
  );

  useEffect(() => {
    if (!messages.length) {
      setMessages([createWelcomeMessage(role, location.pathname)]);
    }
  }, [location.pathname, messages.length, role]);

  useEffect(() => {
    if (!isOpen || hasLoadedSummary) {
      return;
    }

    void sendMessage('Give me a quick summary of what I can do here.', true);
    setHasLoadedSummary(true);
  }, [hasLoadedSummary, isOpen]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    setHasLoadedSummary(false);
    setMessages([createWelcomeMessage(role, location.pathname)]);
  }, [location.pathname, role]);

  const sendMessage = async (message, silentUserMessage = false) => {
    const trimmed = String(message || '').trim();
    if (!trimmed) {
      return;
    }

    if (!silentUserMessage) {
      setMessages((current) => [
        ...current,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: trimmed
        }
      ]);
    }

    setLoading(true);

    try {
      const token = await getToken();
      const response = await fetch('http://localhost:8000/api/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          message: trimmed,
          page: location.pathname,
          role
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Chatbot is unavailable right now');
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: data.reply,
          actions: Array.isArray(data.actions) ? data.actions : [],
          prompts: Array.isArray(data.suggestedPrompts) ? data.suggestedPrompts : []
        }
      ]);
    } catch (error) {
      console.error(error);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          sender: 'assistant',
          text: `I couldn't reach the live assistant just now. ${error.message}. You can still use the quick prompts below or open a module directly.`,
          actions: [
            { label: 'Open Mission Control', route: '/dashboard' },
            { label: 'Open Data Intake', route: '/intake' }
          ]
        }
      ]);
    } finally {
      setLoading(false);
      setInput('');
    }
  };

  const handleAction = (route) => {
    setIsOpen(false);
    navigate(route.replace('#notifications', ''));
  };

  const latestPromptSet = [...suggestedPrompts];
  const dynamicPrompts = messages[messages.length - 1]?.prompts || [];
  const visiblePrompts = Array.from(new Set([...dynamicPrompts, ...latestPromptSet])).slice(0, 4);

  return (
    <>
      <button
        type="button"
        className="chatbot-launcher"
        onClick={() => setIsOpen((current) => !current)}
        aria-label={isOpen ? 'Close operations assistant' : 'Open operations assistant'}
      >
        <div className="chatbot-launcher__icon">
          {isOpen ? <X size={20} /> : <MessageSquare size={20} />}
        </div>
        <div className="chatbot-launcher__text">
          <span>Ops Assistant</span>
          <small>{roleDefinitions[role]?.label || 'Viewer'} mode</small>
        </div>
      </button>

      {isOpen ? (
        <aside className="chatbot-panel glass-panel">
          <div className="chatbot-panel__header">
            <div>
              <p className="chatbot-kicker">
                <Sparkles size={14} />
                Interactive Operations Chat
              </p>
              <h3>ResourceSync Assistant</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                Role-aware guidance for Mission Control, intake, reviews, and volunteer flow.
              </p>
            </div>
            <button type="button" className="btn-secondary chatbot-close-btn" onClick={() => setIsOpen(false)} style={{ padding: '10px 12px' }}>
              <X size={16} />
            </button>
          </div>

          <div className="chatbot-main">
            <div ref={scrollRef} className="chatbot-thread">
              {messages.map((message) => (
                <div key={message.id} className={`chatbot-message chatbot-message--${message.sender}`}>
                  <div className="chatbot-message__avatar">
                    {message.sender === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className="chatbot-message__body">
                    <p style={{ whiteSpace: 'pre-wrap' }}>{message.text}</p>
                    {message.actions?.length ? (
                      <div className="chatbot-actions">
                        {message.actions.map((action) => (
                          <button
                            key={`${message.id}-${action.route}-${action.label}`}
                            type="button"
                            className="btn-secondary chatbot-action"
                            onClick={() => handleAction(action.route)}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {loading ? (
                <div className="chatbot-message chatbot-message--assistant">
                  <div className="chatbot-message__avatar">
                    <Bot size={16} />
                  </div>
                  <div className="chatbot-message__body chatbot-message__body--loading">
                    <LoaderCircle size={16} className="spinning" />
                    <span>Analyzing live platform context...</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="chatbot-dock">
            <div className="chatbot-prompts">
              {visiblePrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="chatbot-prompt"
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              className="chatbot-input"
              onSubmit={(event) => {
                event.preventDefault();
                void sendMessage(input);
              }}
            >
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                className="input-field"
                placeholder="Ask about urgent needs, approvals, volunteers, or workflow..."
              />
              <button type="submit" className="btn-primary" disabled={loading || !input.trim()} style={{ padding: '12px 16px' }}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </aside>
      ) : null}
    </>
  );
}
