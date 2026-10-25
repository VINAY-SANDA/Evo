import { useState, useRef, useEffect } from 'react';
import type { AiMessage } from '../../types';
import { sendAiChatMessage } from '../../services/api';
import './AiChatPage.css';

const quickPrompts = [
  'What should I do today?',
  'Plan my week',
  'How am I doing this month?',
  'What goals are at risk?',
  'How much do I need to save?',
  'Show my progress',
];

export default function AiChatPage() {
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      id: 'msg_initial',
      role: 'assistant',
      content: "Greetings Vinay. I am EVO, your personal operating system strategic advisor. I'm connected live to your database metrics, habit streaks, and vision goals. How can I assist your execution today?",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: AiMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await sendAiChatMessage(text.trim());
      setMessages(prev => [...prev, response]);
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_${Date.now()}_err`,
          role: 'assistant',
          content: 'I encountered a brief reasoning delay. Your daily goals and streaks remain active.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleActionClick = (actionKey: string, label: string) => {
    if (actionKey === 'accept_plan') {
      sendMessage('I accept the plan. Synchronize it with my daily tasks schedule.');
    } else if (actionKey === 'adjust_plan') {
      sendMessage('Adjust my daily plan to bring the at-risk goals back on track.');
    } else {
      sendMessage(`Action chosen: ${label}`);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: 'msg_welcome',
        role: 'assistant',
        content: "Conversation history cleared. What's on your mind today? I can help plan your day, analyze your runway, or review your technical mastery tracks.",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatContent = (content: string) => {
    return content.split('\n').map((line, i) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <h4 key={i} className="ai-line-heading">{line.replace(/\*\*/g, '')}</h4>;
      }
      if (line.match(/^\*\*.*\*\*$/)) {
        return <h4 key={i} className="ai-line-heading">{line.replace(/\*\*/g, '')}</h4>;
      }
      if (line.startsWith('• ') || line.startsWith('- ')) {
        const formatted = line.slice(2).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <div key={i} className="ai-line-bullet" dangerouslySetInnerHTML={{ __html: `• ${formatted}` }} />;
      }
      if (line.startsWith('✅') || line.startsWith('⚠️') || line.startsWith('❌')) {
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <div key={i} className="ai-line-status" dangerouslySetInnerHTML={{ __html: formatted }} />;
      }
      if (line.match(/^\*\*\d+\./)) {
        const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return <div key={i} className="ai-line-numbered" dangerouslySetInnerHTML={{ __html: formatted }} />;
      }
      if (line.trim() === '') return <br key={i} />;
      const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return <p key={i} className="ai-line-text" dangerouslySetInnerHTML={{ __html: formatted }} />;
    });
  };

  return (
    <div className="ai-chat-page">
      <div className="ai-chat-header">
        <div className="ai-chat-header-left">
          <div className="ai-chat-avatar">
            <span>E</span>
          </div>
          <div>
            <h1 className="ai-chat-title">EVO AI Strategic Coach</h1>
            <p className="ai-chat-status">
              {isTyping ? (
                <span className="typing-indicator">
                  <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  Synthesizing strategy...
                </span>
              ) : 'Active Reasoning Online • Zero Excuses Mode'}
            </p>
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleClearChat}>Clear Chat</button>
      </div>

      <div className="ai-chat-body">
        {/* Quick Prompts */}
        {messages.length <= 1 && (
          <div className="ai-quick-prompts animate-fade-in-up">
            <p className="ai-quick-title">Quick Strategic Queries:</p>
            <div className="ai-quick-grid">
              {quickPrompts.map(prompt => (
                <button
                  key={prompt}
                  className="ai-quick-btn"
                  onClick={() => sendMessage(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="ai-chat-messages">
          {messages.map(msg => (
            <div key={msg.id} className={`ai-message ${msg.role}`}>
              <div className="ai-message-avatar">
                {msg.role === 'assistant' ? 'E' : 'V'}
              </div>
              <div className="ai-message-content">
                <div className="ai-message-bubble">
                  {msg.role === 'assistant' ? formatContent(msg.content) : msg.content}
                </div>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="ai-message-actions">
                    {msg.actions.map(action => (
                      <button
                        key={action.id}
                        className={`btn ${action.type === 'primary' ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}`}
                        onClick={() => handleActionClick(action.action, action.label)}
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}
                <span className="ai-message-time">
                  {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="ai-message assistant">
              <div className="ai-message-avatar">E</div>
              <div className="ai-message-content">
                <div className="ai-message-bubble ai-typing-bubble">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="ai-chat-input-area">
        <div className="ai-chat-input-container">
          <input
            ref={inputRef}
            type="text"
            className="ai-chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask EVO to prioritize, review code schedule, calculate runway..."
            disabled={isTyping}
          />
          <button
            className="ai-chat-send"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
          >
            ↑
          </button>
        </div>
        <p className="ai-chat-disclaimer">EVO AI analyzes your active habits, goals, and metrics to give actionable directives.</p>
      </div>
    </div>
  );
}
