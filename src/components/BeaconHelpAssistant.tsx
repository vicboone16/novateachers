import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWalkthrough } from '@/contexts/WalkthroughContext';
import { WALKTHROUGH_FLOWS } from '@/lib/walkthrough-flows';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bot, Send, Loader2, ExternalLink, Play, BookOpen, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

/** Parse action links from assistant response */
function parseActions(text: string): { label: string; type: 'page' | 'walkthrough' | 'faq'; target: string }[] {
  const actions: { label: string; type: 'page' | 'walkthrough' | 'faq'; target: string }[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const pageMatch = line.match(/\[page:(\/[^\]]+)\]\s*(.+)/);
    if (pageMatch) {
      actions.push({ type: 'page', target: pageMatch[1], label: pageMatch[2].trim() });
      continue;
    }
    const wtMatch = line.match(/\[walkthrough:([^\]]+)\]\s*(.+)/);
    if (wtMatch) {
      actions.push({ type: 'walkthrough', target: wtMatch[1], label: wtMatch[2].trim() });
      continue;
    }
    if (line.match(/\[faq\]/i)) {
      actions.push({ type: 'faq', target: '/faq', label: 'View Help Center' });
    }
  }
  return actions;
}

/** Strip action markup from text for display */
function cleanText(text: string): string {
  return text
    .replace(/\[page:\/[^\]]+\]\s*.+/g, '')
    .replace(/\[walkthrough:[^\]]+\]\s*.+/g, '')
    .replace(/\[faq\]\s*.*/gi, '')
    .replace(/Suggested actions:\s*$/gim, '')
    .trim();
}

const QUICK_QUESTIONS = [
  'How do I send a Mayday?',
  'How do I add points?',
  "What is Who's Here?",
  'How do I message parents?',
  'How do I create rewards?',
];

export const BeaconHelpAssistant = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { startFlow, isActive: walkthroughActive } = useWalkthrough();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const askQuestion = useCallback(async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('beacon-help-assistant', {
        body: { question, currentRoute: pathname },
      });

      if (error) throw error;

      const answer = data?.answer || "I'm not sure about that. Try the Help Center at /faq.";
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (err) {
      console.error('Help assistant error:', err);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "Sorry, I couldn't process that right now. Try checking the Help Center." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [loading, pathname]);

  const handleAction = (action: { type: string; target: string }) => {
    if (action.type === 'page' || action.type === 'faq') {
      setOpen(false);
      setTimeout(() => navigate(action.target), 150);
    } else if (action.type === 'walkthrough') {
      const flow = WALKTHROUGH_FLOWS.find((f) => f.id === action.target);
      if (flow) {
        setOpen(false);
        setTimeout(() => startFlow(flow), 200);
      }
    }
  };

  if (walkthroughActive) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          className="fixed bottom-20 left-4 sm:bottom-6 sm:left-6 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center hover:scale-105 active:scale-95"
          aria-label="Beacon Help Assistant"
        >
          <Bot className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-[400px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <SheetTitle className="text-base flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            Beacon Help Assistant
          </SheetTitle>
          <p className="text-xs text-muted-foreground">Ask me anything about using Beacon.</p>
        </SheetHeader>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3 pt-4">
              <p className="text-sm text-muted-foreground text-center">Try a question:</p>
              <div className="space-y-2">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => askQuestion(q)}
                    className="w-full text-left px-3 py-2 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 text-sm transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const actions = isUser ? [] : parseActions(msg.content);
            const displayText = isUser ? msg.content : cleanText(msg.content);

            return (
              <div key={i} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                    isUser
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{displayText}</p>

                  {actions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {actions.map((a, j) => (
                        <Button
                          key={j}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1 bg-background/80"
                          onClick={() => handleAction(a)}
                        >
                          {a.type === 'walkthrough' && <Play className="h-3 w-3" />}
                          {a.type === 'page' && <ExternalLink className="h-3 w-3" />}
                          {a.type === 'faq' && <BookOpen className="h-3 w-3" />}
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-xl px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Thinking…
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              askQuestion(input);
            }}
            className="flex gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              className="h-9 text-sm"
              disabled={loading}
            />
            <Button type="submit" size="sm" className="h-9 w-9 p-0" disabled={loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
};
