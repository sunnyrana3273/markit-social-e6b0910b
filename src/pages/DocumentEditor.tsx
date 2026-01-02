import React, { useState, useEffect, useRef } from 'react';
import { Excalidraw } from "@excalidraw/excalidraw";
import { exportToCanvas } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MessageSquare, Users, Send, Command, Move, UserPlus, Timer, X, Sparkles, Plus, Phone, BotMessageSquare, Save, Eraser, Pencil, FileText } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { FriendChat } from '@/components/FriendChat';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogOverlay, DialogPortal } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { toast } from 'sonner';
import * as pdfjsLib from 'pdfjs-dist';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { RealtimeChannel } from "@supabase/supabase-js";
import { useTheme } from "@/contexts/ThemeContext";
import { useCall } from "@/contexts/CallContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Backend API URL - uses environment variable in production
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Component to render text with LaTeX math support
interface MathTextProps {
  text: string;
  className?: string;
}

export const MathText: React.FC<MathTextProps> = ({ text, className = '' }) => {
  // Function to parse text and render LaTeX equations
  const renderMathText = (text: string) => {
    // Split by paragraphs first to handle block-level formatting
    const paragraphs = text.split(/\n\n+/);
    const result: React.ReactNode[] = [];
    let globalKeyCounter = 0;
    
    paragraphs.forEach((para, paraIdx) => {
      if (!para.trim()) return;
      
      const paraResult: React.ReactNode[] = [];
      // Support both \(...\) for inline and \[...\] for block, and also $...$ and $$...$$
      const mathRegex = /(\\\(|\\\)|\\\[|\\\]|\$\$|\$)/;
      const parts = para.split(mathRegex);
      
      let isInlineMath = false;
      let isBlockMath = false;
      let currentMath = '';
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (part === '\\(' || part === '$') {
          isInlineMath = true;
          currentMath = '';
        } else if (part === '\\)' || (part === '$' && isInlineMath && currentMath)) {
          isInlineMath = false;
          if (currentMath.trim()) {
            try {
              paraResult.push(
                <InlineMath key={`inline-${globalKeyCounter++}`} math={currentMath.trim()} />
              );
            } catch (e) {
              paraResult.push(<span key={`error-${globalKeyCounter++}`} className="text-red-500">Math error</span>);
            }
          }
          currentMath = '';
        } else if (part === '\\[' || part === '$$') {
          isBlockMath = true;
          currentMath = '';
        } else if (part === '\\]' || (part === '$$' && isBlockMath && currentMath)) {
          isBlockMath = false;
          if (currentMath.trim()) {
            try {
              paraResult.push(
                <div key={`block-${globalKeyCounter++}`} className="my-2 overflow-x-auto text-center">
                  <BlockMath math={currentMath.trim()} />
                </div>
              );
            } catch (e) {
              paraResult.push(<div key={`error-${globalKeyCounter++}`} className="text-red-500 my-2">Math error</div>);
            }
          }
          currentMath = '';
        } else if (isInlineMath || isBlockMath) {
          currentMath += part;
        } else {
          // Regular text - check for special formatting
          if (part) {
            // Handle \boxed{} commands for answers - handle nested braces
            if (part.includes('\\boxed{')) {
              let processedPart = part;
              const fragments: React.ReactNode[] = [];
              let startIdx = 0;
              
              // Find all \boxed{...} occurrences, handling nested braces
              while (true) {
                const boxedStart = processedPart.indexOf('\\boxed{', startIdx);
                if (boxedStart === -1) break;
                
                // Add text before the boxed
                if (boxedStart > startIdx) {
                  const beforeText = processedPart.substring(startIdx, boxedStart);
                  if (beforeText.trim()) {
                    fragments.push(
                      <span key={`pre-boxed-${globalKeyCounter++}`}>
                        {beforeText}
                      </span>
                    );
                  }
                }
                
                // Find matching closing brace (handle nested braces)
                let braceCount = 0;
                let contentStart = boxedStart + 7; // length of '\boxed{'
                let contentEnd = contentStart;
                
                for (let i = contentStart; i < processedPart.length; i++) {
                  if (processedPart[i] === '{') braceCount++;
                  else if (processedPart[i] === '}') {
                    if (braceCount === 0) {
                      contentEnd = i;
                      break;
                    }
                    braceCount--;
                  }
                }
                
                if (contentEnd > contentStart) {
                  const boxedContent = processedPart.substring(contentStart, contentEnd);
                  
                  // Add the boxed answer with special styling
                  try {
                    fragments.push(
                      <span 
                        key={`boxed-${globalKeyCounter++}`} 
                        className="inline-block mt-1.5 px-2.5 py-1 bg-blue-50 border-2 border-blue-400 rounded font-mono text-sm font-bold text-blue-900"
                      >
                        <InlineMath math={boxedContent} />
                      </span>
                    );
                  } catch (e) {
                    fragments.push(
                      <span 
                        key={`boxed-text-${globalKeyCounter++}`}
                        className="inline-block mt-1.5 px-2.5 py-1 bg-blue-50 border-2 border-blue-400 rounded font-mono text-sm font-bold text-blue-900"
                      >
                        {boxedContent}
                      </span>
                    );
                  }
                  
                  startIdx = contentEnd + 1;
                } else {
                  // Malformed, skip
                  startIdx = boxedStart + 7;
                }
              }
              
              // Add remaining text
              if (startIdx < processedPart.length) {
                const remaining = processedPart.substring(startIdx);
                if (remaining.trim()) {
                  fragments.push(
                    <span key={`post-boxed-${globalKeyCounter++}`}>
                      {remaining}
                    </span>
                  );
                }
              }
              
              if (fragments.length > 0) {
                paraResult.push(
                  <div key={`boxed-container-${globalKeyCounter++}`} className="my-1.5">
                    {fragments}
                  </div>
                );
                continue;
              }
            }
            
            // Check for bold headings (Step 1, Step 2, etc.) or markdown bold
            const stepMatch = part.match(/^(Step \d+\.?|\*\*Step \d+\.?\*\*)/i);
            const boldMatch = part.match(/\*\*([^*]+)\*\*/g);
            
            if (stepMatch || boldMatch) {
              let processedText = part;
              
              // Handle bold text (markdown **text**)
              if (boldMatch) {
                boldMatch.forEach(match => {
                  const boldText = match.replace(/\*\*/g, '');
                  processedText = processedText.replace(match, `<strong>${boldText}</strong>`);
                });
              }
              
              // Handle step headings - make them larger and bold
              if (stepMatch) {
                processedText = processedText.replace(/^(Step \d+\.?)/i, '<strong class="text-base font-semibold">$1</strong>');
              }
              
              paraResult.push(
                <div 
                  key={`para-${globalKeyCounter++}`} 
                  className="mb-1.5 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(processedText) }}
                />
              );
            } else {
              // Regular paragraph text - preserve line breaks
              const lines = part.split('\n');
              lines.forEach((line, lineIdx) => {
                if (line.trim() || lineIdx === 0) {
                  paraResult.push(
                    <span key={`text-${globalKeyCounter++}`} className="whitespace-pre-wrap break-words">
                      {line}
                    </span>
                  );
                }
              });
            }
          }
        }
      }
      
      // Handle any remaining math that wasn't closed
      if (currentMath.trim()) {
        if (isBlockMath) {
          try {
            paraResult.push(
              <div key={`block-remaining-${globalKeyCounter++}`} className="my-2 overflow-x-auto text-center">
                <BlockMath math={currentMath.trim()} />
              </div>
            );
          } catch (e) {
            paraResult.push(<div key={`error-remaining-${globalKeyCounter++}`} className="text-red-500">Math error</div>);
          }
        } else if (isInlineMath) {
          try {
            paraResult.push(
              <InlineMath key={`inline-remaining-${globalKeyCounter++}`} math={currentMath.trim()} />
            );
          } catch (e) {
            paraResult.push(<span key={`error-remaining-${globalKeyCounter++}`} className="text-red-500">Math error</span>);
          }
        }
      }
      
      // Wrap paragraph content in a div for spacing
      if (paraResult.length > 0) {
        // Check if paragraph contains any block-level elements (divs)
        const hasBlockElements = paraResult.some((node: any) => 
          node?.type === 'div'
        );
        
        // Check if paragraph contains block math (centered equations)
        const hasBlockMath = paraResult.some((node: any) => 
          node?.type === 'div' && node?.props?.className?.includes('text-center')
        );
        
        if (hasBlockElements || hasBlockMath || para.trim().startsWith('**') || /^Step \d+\.?/i.test(para.trim())) {
          // Block-level content (equations, headings, divs)
          result.push(
            <div key={`block-para-${paraIdx}`} className="mb-2">
              {paraResult}
            </div>
          );
        } else {
          // Inline/regular paragraph (no block elements)
          result.push(
            <p key={`para-${paraIdx}`} className="mb-2 leading-relaxed">
              {paraResult}
            </p>
          );
        }
      }
    });
    
    return result;
  };

  return (
    <div className={`${className} text-sm leading-relaxed -my-1`}>
      {renderMathText(text)}
    </div>
  );
};

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const shiftDateString = (dateStr: string, offset: number) => {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return formatLocalDate(date);
};

const calculateCurrentStreakFromDates = (activeDates: Set<string>) => {
  let current = 0;
  let cursor = formatLocalDate(new Date());

  while (activeDates.has(cursor)) {
    current += 1;
    cursor = shiftDateString(cursor, -1);
  }

  return current;
};

const calculateLongestStreakFromDates = (activeDates: Set<string>) => {
  let longest = 0;

  activeDates.forEach((dateStr) => {
    const previous = shiftDateString(dateStr, -1);
    if (activeDates.has(previous)) {
      return;
    }

    let length = 0;
    let cursor = dateStr;
    while (activeDates.has(cursor)) {
      length += 1;
      cursor = shiftDateString(cursor, 1);
    }

    if (length > longest) {
      longest = length;
    }
  });

  return longest;
};

interface Friend {
  id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  email: string;
  lastMessageTime?: string;
  role?: 'user' | 'admin';
  plan?: 'free' | 'plus' | 'pro';
  plan_expires_at?: string | null;
}

// Helper function to transform elements for light mode export
// Ensures text and drawing elements have dark colors visible on white background
const transformElementsForLightExport = (elements: any[]): any[] => {
  return elements.map((el: any) => {
    // Skip image elements - they should keep their original colors
    if (el.type === 'image') {
      return el;
    }
    
    // Helper to check if a color is light (needs to be darkened)
    const isLightColor = (color: string): boolean => {
      if (!color || typeof color !== 'string') return false;
      if (!color.startsWith('#')) return false;
      
      // Handle hex colors with alpha
      const hex = color.length === 9 ? color.slice(0, 7) : color;
      if (hex.length !== 7) return false;
      
      try {
        // Extract RGB values
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        
        // Calculate luminance (perceived brightness)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // If luminance is high (bright color), it needs to be darkened
        return luminance > 0.6;
      } catch (e) {
        return false;
      }
    };
    
    const strokeColor = el.strokeColor || el.strokeStyle || '#1e1e1e';
    const isLight = isLightColor(strokeColor);
    
    // For text elements, ALWAYS force dark color to ensure visibility on white background
    // This is critical because text written in dark mode might have white/light colors
    if (el.type === 'text') {
      const originalColor = el.strokeColor || el.strokeStyle || '#1e1e1e';
      const transformed = {
        ...el,
        strokeColor: '#1e1e1e', // Always force dark color for text
        strokeStyle: 'solid', // Ensure solid stroke
      };
      
      // Log transformation for debugging
      if (originalColor !== '#1e1e1e') {
        console.debug('[DocumentEditor] Transforming text element:', {
          originalColor: originalColor,
          newColor: '#1e1e1e',
          elementId: el.id,
          textPreview: el.text?.substring(0, 30) || 'no text'
        });
      }
      
      return transformed;
    }
    
    // For drawing elements (freedraw, rectangle, ellipse, etc.), darken if light
    if (isLight) {
      const transformed = {
        ...el,
        strokeColor: '#1e1e1e', // Force dark color
      };
      
      console.debug('[DocumentEditor] Transforming drawing element:', {
        type: el.type,
        originalColor: strokeColor,
        newColor: '#1e1e1e',
        elementId: el.id
      });
      
      return transformed;
    }
    
    // Keep original if already dark
    return el;
  });
};

const DocumentEditor: React.FC = () => {
  const navigate = useNavigate();
  const { fileId } = useParams();
  const { theme } = useTheme();
  const presenceChannelRef = React.useRef<RealtimeChannel | null>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]); // Thumbnails for display
  const [pdfFullPages, setPdfFullPages] = useState<string[]>([]); // Full-res for canvas insertion
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{ width: number; height: number }[]>([]);
  const [isPdf, setIsPdf] = useState(false);
  const [importedPages, setImportedPages] = useState<Set<number>>(new Set()); // Track which pages have been imported to canvas
  const [scrollPosition, setScrollPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  
  // Load UI states from localStorage on mount
  const getStoredUIState = (key: string, defaultValue: boolean) => {
    if (!fileId) return defaultValue;
    const stored = localStorage.getItem(`docEditor_ui_${fileId}_${key}`);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  };

  const [showFriends, setShowFriends] = useState(() => getStoredUIState('showFriends', true));
  const [isPdfScrollerMinimized, setIsPdfScrollerMinimized] = useState(() => getStoredUIState('isPdfScrollerMinimized', false));
  const [showChatInput, setShowChatInput] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(() => getStoredUIState('showChatSidebar', false));
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(() => {
    // Load saved chat messages from localStorage
    const savedMessages = localStorage.getItem(`chatMessages_${fileId}`);
    return savedMessages ? JSON.parse(savedMessages) : [];
  });
  const [currentChatSessionId, setCurrentChatSessionId] = useState<string | null>(null);
  const [availableChatSessions, setAvailableChatSessions] = useState<Array<{ id: string; created_at: string; title: string | null }>>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState<string>('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false);
  const [currentChatFriend, setCurrentChatFriend] = useState<Friend | null>(null);
  
  // Token usage tracking
  interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
    timestamp: string;
    userMessage: string;
    assistantMessage: string;
  }
  const [tokenLogs, setTokenLogs] = useState<TokenUsage[]>(() => {
    // Load from localStorage
    if (!fileId) return [];
    const saved = localStorage.getItem(`tokenLogs_${fileId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [showTokenLog, setShowTokenLog] = useState(false);
  const [showFriendChat, setShowFriendChat] = useState(() => getStoredUIState('showFriendChat', false));
  const [friendMessages, setFriendMessages] = useState<Array<{ id: string; sender_id: string; receiver_id: string; message: string; created_at: string; read_at: string | null }>>([]);
  const [pendingFriendAttachment, setPendingFriendAttachment] = useState<string | null>(null);
  const [pendingChatAttachment, setPendingChatAttachment] = useState<string | null>(null);
  const [expandedChatImage, setExpandedChatImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chatPosition, setChatPosition] = useState({ x: 50, y: window.innerHeight - 120 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // Initialize Twilio call hook
  const { initiateCall } = useCall();

  useEffect(() => {
    document.title = "MarkIt | Document Editor";
  }, []);

  // Excalidraw localStorage persistence helpers
  const getStorageKey = (id?: string) => `markit.documentEditor.excalidraw${id ? `:${id}` : ''}`;
  function debounce<T extends (...args: any[]) => void>(fn: T, delay = 500) {
    let handle: number | undefined;
    return (...args: Parameters<T>) => {
      if (handle) window.clearTimeout(handle);
      handle = window.setTimeout(() => fn(...args), delay);
    };
  }
  const lastSerializedRef = React.useRef<string | null>(null);
  
  // Timer state
  const [totalStudyTime, setTotalStudyTime] = useState(0); // in seconds
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const [isTimerActive, setIsTimerActive] = useState(true);
  const [isTimerMinimized, setIsTimerMinimized] = useState(() => getStoredUIState('isTimerMinimized', false));
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'plus' | 'pro' | 'admin' | null>(null);
  const lastSyncedMetricsRef = useRef<{ date: string; minutes: number; problems: number } | null>(null);
  
  // Capture preview state removed

  // Load token logs when fileId changes
  useEffect(() => {
    if (fileId) {
      const saved = localStorage.getItem(`tokenLogs_${fileId}`);
      if (saved) {
        try {
          setTokenLogs(JSON.parse(saved));
        } catch (e) {
          console.error('Error loading token logs:', e);
          setTokenLogs([]);
        }
      } else {
        setTokenLogs([]);
      }
    }
  }, [fileId]);

  // Save UI states to localStorage whenever they change
  useEffect(() => {
    if (fileId) {
      localStorage.setItem(`docEditor_ui_${fileId}_showFriends`, JSON.stringify(showFriends));
    }
  }, [showFriends, fileId]);

  useEffect(() => {
    if (fileId) {
      localStorage.setItem(`docEditor_ui_${fileId}_isPdfScrollerMinimized`, JSON.stringify(isPdfScrollerMinimized));
    }
  }, [isPdfScrollerMinimized, fileId]);

  useEffect(() => {
    if (fileId) {
      localStorage.setItem(`docEditor_ui_${fileId}_showChatSidebar`, JSON.stringify(showChatSidebar));
    }
  }, [showChatSidebar, fileId]);

  useEffect(() => {
    if (fileId) {
      // Only save showFriendChat state if there's actually a friend to chat with
      if (currentChatFriend) {
        localStorage.setItem(`docEditor_ui_${fileId}_showFriendChat`, JSON.stringify(showFriendChat));
      } else {
        // Clear the stored state if no friend is selected
        localStorage.removeItem(`docEditor_ui_${fileId}_showFriendChat`);
      }
    }
  }, [showFriendChat, currentChatFriend, fileId]);

  useEffect(() => {
    if (fileId) {
      localStorage.setItem(`docEditor_ui_${fileId}_isTimerMinimized`, JSON.stringify(isTimerMinimized));
    }
  }, [isTimerMinimized, fileId]);

  // Load saved timer data on component mount
  useEffect(() => {
    const savedTime = localStorage.getItem(`studyTime_${fileId}`);
    
    if (savedTime) {
      setTotalStudyTime(parseInt(savedTime));
    }
    
    // Always start a fresh session when entering the whiteboard
    const now = Date.now();
    setSessionStartTime(now);
    setLastActivityTime(now);
    setIsTimerActive(true);
    localStorage.setItem(`sessionStart_${fileId}`, now.toString());

    // Update global streak: opening any document counts as a day
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const todayStr = `${yyyy}-${mm}-${dd}`;
      const lastDate = localStorage.getItem('studyStreak:lastDate');
      const currentCount = parseInt(localStorage.getItem('studyStreak:count') || '0', 10) || 0;
      const kpAwardedToday = localStorage.getItem(`streakKpAwarded:${todayStr}`) === 'true';

      const toDate = (s: string) => {
        const [Y, M, D] = s.split('-').map(Number);
        return new Date(Y, (M || 1) - 1, D || 1);
      };

      let nextCount = currentCount;
      let shouldAwardKP = false;
      let kpToAward = 0;

      if (!lastDate) {
        nextCount = 1;
        if (!kpAwardedToday) {
          shouldAwardKP = true;
          kpToAward = 1;
        }
      } else {
        const last = toDate(lastDate);
        const diffDays = Math.floor((new Date(yyyy, parseInt(mm, 10) - 1, parseInt(dd, 10)).getTime() - last.getTime()) / 86400000);
        if (diffDays === 0) {
          // same day: no change
          nextCount = currentCount || 1;
        } else if (diffDays === 1) {
          // Streak continues: increment and award points equal to new streak count
          nextCount = currentCount + 1;
          if (!kpAwardedToday) {
            shouldAwardKP = true;
            kpToAward = nextCount;
          }
        } else if (diffDays > 1) {
          // Streak broken: start over
          nextCount = 1;
          if (!kpAwardedToday) {
            shouldAwardKP = true;
            kpToAward = 1;
          }
        } else {
          // If clock went backwards, keep current
          nextCount = Math.max(currentCount, 1);
        }
      }

      localStorage.setItem('studyStreak:lastDate', todayStr);
      localStorage.setItem('studyStreak:count', String(nextCount));

      // Award knowledge points if needed
      if (shouldAwardKP && kpToAward > 0) {
        (async () => {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              // Fetch current knowledge points
              const { data: profile, error: fetchError } = await supabase
                .from('profiles')
                .select('knowledge_points')
                .eq('id', user.id)
                .single();
              
              if (fetchError) {
                console.error('Error fetching profile for KP award:', fetchError);
                return;
              }
              
              // Update with incremented value
              const newKP = (profile?.knowledge_points || 0) + kpToAward;
              const { error: updateError } = await supabase
                .from('profiles')
                .update({ knowledge_points: newKP })
                .eq('id', user.id);
              
              if (updateError) {
                console.error('Error awarding streak knowledge points:', updateError);
              } else {
                localStorage.setItem(`streakKpAwarded:${todayStr}`, 'true');
              }
            }
          } catch (e) {
            console.error('Error awarding streak knowledge points:', e);
          }
        })();
      }
    } catch (e) {
      // ignore
    }
  }, [fileId]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error('[DocumentEditor] Error loading user for metrics sync:', error);
          return;
        }

        const user = data?.user;
        if (!user) {
          navigate('/auth');
          return;
        }

        setCurrentUserId(user.id);

        // Fetch user profile to get plan
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('plan, role, plan_expires_at')
          .eq('id', user.id)
          .single();

        if (!profileError && profile) {
          // Check if plan has expired
          if (profile.plan_expires_at) {
            const expiresAt = new Date(profile.plan_expires_at);
            const now = new Date();
            if (expiresAt < now && profile.plan && profile.plan !== 'free') {
              setUserPlan('free');
            } else {
              setUserPlan(profile.role === 'admin' ? 'admin' : (profile.plan || 'free'));
            }
          } else {
            setUserPlan(profile.role === 'admin' ? 'admin' : (profile.plan || 'free'));
          }
        } else {
          setUserPlan('free'); // Default to free if profile fetch fails
        }
      } catch (err) {
        console.error('[DocumentEditor] Unexpected error loading user for metrics sync:', err);
        setUserPlan('free'); // Default to free on error
      }
    };

    void loadCurrentUser();
  }, [navigate]);

  useEffect(() => {
    if (!excalidrawAPI) {
      console.debug('[DocumentEditor] excalidrawAPI not available for capture listener');
      return;
    }

    console.debug('[DocumentEditor] Setting up whiteboard capture listener');
    const captureChannel = new BroadcastChannel('whiteboard-capture');

    captureChannel.onmessage = async (event) => {
      const payload = event.data as { type?: string; requestId?: string };
      if (!payload || payload.type !== 'capture-request' || !payload.requestId) {
        console.debug('[DocumentEditor] Invalid capture request payload:', payload);
        return;
      }

      console.debug('[DocumentEditor] Received capture request:', payload.requestId);
      
      try {
        if (!excalidrawAPI) {
          throw new Error('excalidrawAPI is not available');
        }

        let elements = excalidrawAPI.getSceneElements?.() || [];
        const appState = excalidrawAPI.getAppState?.() || {};
        const files = excalidrawAPI.getFiles?.() || {};
        
        // Filter out deleted elements - they shouldn't be in the export
        elements = elements.filter((el: any) => !el.isDeleted);
        
        // Log element types to debug what's being captured
        const elementTypes = elements.reduce((acc: any, el: any) => {
          acc[el.type] = (acc[el.type] || 0) + 1;
          return acc;
        }, {});
        
        console.debug('[DocumentEditor] Capturing whiteboard:', {
          totalElements: elements.length,
          elementTypes,
          hasAppState: !!appState,
          filesCount: Object.keys(files).length,
          viewBackgroundColor: appState.viewBackgroundColor
        });

        // Small delay to ensure all elements are rendered
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Re-fetch elements after delay to ensure we have the latest state
        elements = excalidrawAPI.getSceneElements?.() || [];
        elements = elements.filter((el: any) => !el.isDeleted);
        
        // Transform elements to ensure dark colors for light mode export
        const transformedElements = transformElementsForLightExport(elements);
        
        // Log text elements specifically for debugging
        const textElements = transformedElements.filter((el: any) => el.type === 'text');
        if (textElements.length > 0) {
          console.debug('[DocumentEditor] Text elements being exported:', textElements.map((el: any) => ({
            id: el.id,
            strokeColor: el.strokeColor,
            textPreview: el.text?.substring(0, 30),
            strokeStyle: el.strokeStyle,
            fillStyle: el.fillStyle
          })));
        }
        
        const canvas = await exportToCanvas({
          elements: transformedElements,
          appState: {
            ...appState,
            exportBackground: true, // Ensure background is exported
            viewBackgroundColor: '#ffffff', // Force white background for consistent export regardless of theme
            exportWithDarkMode: false, // Force light mode colors so text is visible (black text on white/light backgrounds)
          },
          files,
          getDimensions: (width, height, scale) => {
            // Ensure we capture the full scene
            return { width, height, scale };
          },
        });
        
        if (!canvas) {
          throw new Error('exportToCanvas returned null or undefined');
        }
        
        const dataURL = canvas.toDataURL('image/png');
        console.debug('[DocumentEditor] Whiteboard captured successfully:', {
          size: dataURL.length,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          elementsCaptured: elements.length
        });
        captureChannel.postMessage({ requestId: payload.requestId, image: dataURL });
      } catch (error) {
        console.error('[DocumentEditor] Failed to capture whiteboard for attachment:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unable to capture whiteboard preview.';
        captureChannel.postMessage({ requestId: payload.requestId, error: errorMessage });
      }
    };

    return () => {
      console.debug('[DocumentEditor] Cleaning up whiteboard capture listener');
      captureChannel.close();
    };
  }, [excalidrawAPI]);

  const syncDailyMetrics = React.useCallback(async () => {
    if (!currentUserId) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      const suffix = `:${dateKey}`;

      let totalSeconds = 0;
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (!key) continue;
        if (key.startsWith('studySeconds:') && key.endsWith(suffix)) {
          const value = parseInt(localStorage.getItem(key) || '0', 10);
          if (!Number.isNaN(value)) {
            totalSeconds += value;
          }
        }
      }

      const minutesStudied = Math.floor(totalSeconds / 60);
      let problemsSolved = parseInt(localStorage.getItem(`problemsSolved:${dateKey}`) || '0', 10);
      if (Number.isNaN(problemsSolved)) {
        problemsSolved = 0;
      }

      const lastSynced = lastSyncedMetricsRef.current;
      if (
        lastSynced &&
        lastSynced.date === dateKey &&
        lastSynced.minutes === minutesStudied &&
        lastSynced.problems === problemsSolved
      ) {
        return;
      }

      const { error } = await supabase
        .from('daily_metrics')
        .upsert(
          {
            user_id: currentUserId,
            date: dateKey,
            minutes_studied: minutesStudied,
            problems_completed: problemsSolved,
          },
          { onConflict: 'user_id,date' }
        );

      if (error) {
        console.error('[DocumentEditor] Failed to sync daily metrics:', error);
        return;
      }

      const { data: allMetrics, error: allMetricsError } = await supabase
        .from('daily_metrics')
        .select('date, minutes_studied, problems_completed')
        .eq('user_id', currentUserId);

      if (allMetricsError) {
        console.error('[DocumentEditor] Failed to load metrics for lifetime sync:', allMetricsError);
      } else if (allMetrics) {
        let lifetimeMinutes = 0;
        let lifetimeProblems = 0;
        const activeDates = new Set<string>();
        let lastStudyDate: string | null = null;

        allMetrics.forEach((metric) => {
          const minutes = metric.minutes_studied ?? 0;
          const problems = metric.problems_completed ?? 0;
          lifetimeMinutes += minutes;
          lifetimeProblems += problems;
          if (minutes > 0 || problems > 0) {
            if (metric.date) {
              activeDates.add(metric.date);
              if (!lastStudyDate || metric.date > lastStudyDate) {
                lastStudyDate = metric.date;
              }
            }
          }
        });

        const currentStreak = calculateCurrentStreakFromDates(activeDates);
        const historicalLongest = calculateLongestStreakFromDates(activeDates);
        const longestStreak = Math.max(historicalLongest, currentStreak);

        const { error: statsError } = await supabase
          .from('user_stats')
          .upsert(
            {
              user_id: currentUserId,
              lifetime_minutes_studied: lifetimeMinutes,
              lifetime_questions_answered: lifetimeProblems,
              longest_streak: longestStreak,
              current_streak: currentStreak,
              last_study_date: lastStudyDate,
            },
            { onConflict: 'user_id' }
          );

        if (statsError) {
          console.error('[DocumentEditor] Failed to update user_stats:', statsError);
        }
      }

      lastSyncedMetricsRef.current = { date: dateKey, minutes: minutesStudied, problems: problemsSolved };
    } catch (error) {
      console.error('[DocumentEditor] Error syncing study metrics:', error);
    }
  }, [currentUserId]);

  // Cleanup when component unmounts (user navigates away)
  useEffect(() => {
    return () => {
      // Save current progress when leaving the whiteboard
      if (sessionStartTime && isTimerActive) {
        const now = Date.now();
        const sessionTime = Math.floor((now - sessionStartTime) / 1000);
        const currentTotal = totalStudyTime + sessionTime;
        localStorage.setItem(`studyTime_${fileId}`, currentTotal.toString());
      }
      void syncDailyMetrics();
    };
  }, [sessionStartTime, isTimerActive, totalStudyTime, fileId, syncDailyMetrics]);

  useEffect(() => {
    if (currentUserId) {
      void syncDailyMetrics();
    }
  }, [currentUserId, syncDailyMetrics]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }
    const interval = window.setInterval(() => {
      void syncDailyMetrics();
    }, 60000);
    return () => window.clearInterval(interval);
  }, [currentUserId, syncDailyMetrics]);

  useEffect(() => {
    if (!currentUserId) {
      return;
    }
    const handleBeforeUnload = () => {
      void syncDailyMetrics();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentUserId, syncDailyMetrics]);

  // Activity tracking and timer logic
  useEffect(() => {
    const activityTimeout = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityTime;
      
      // If no activity for 2 minutes (120000ms), pause timer
      if (timeSinceActivity >= 120000 && isTimerActive) {
        setIsTimerActive(false);
        console.log('Timer paused due to inactivity');
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(activityTimeout);
  }, [lastActivityTime, isTimerActive]);

  // Update timer every second
  useEffect(() => {
    const timerInterval = setInterval(() => {
      if (isTimerActive && sessionStartTime) {
        const now = Date.now();
        const sessionTime = Math.floor((now - sessionStartTime) / 1000);
        
        // Update display time (but don't save to total until session ends)
        setTotalStudyTime(totalStudyTime + sessionTime);
        setSessionStartTime(now);

        // Also track today's per-document study seconds in localStorage
        try {
          const today = new Date();
          const y = today.getFullYear();
          const m = String(today.getMonth() + 1).padStart(2, '0');
          const d = String(today.getDate()).padStart(2, '0');
          const yyyyMmDd = `${y}-${m}-${d}`;
          if (fileId) {
            const perDocKey = `studySeconds:${fileId}:${yyyyMmDd}`;
            const prev = parseInt(localStorage.getItem(perDocKey) || '0', 10);
            const next = prev + sessionTime;
            localStorage.setItem(perDocKey, String(next));
          }
        } catch (e) {
          // ignore quota errors
        }
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [isTimerActive, sessionStartTime, totalStudyTime, fileId]);

  // Track user activity
  const updateActivity = () => {
    const now = Date.now();
    setLastActivityTime(now);
    
    // Resume timer if it was paused
    if (!isTimerActive) {
      setIsTimerActive(true);
      setSessionStartTime(now);
      console.log('Timer resumed due to activity');
    }
  };

  // Add activity listeners
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    
    events.forEach(event => {
      document.addEventListener(event, updateActivity, { passive: true });
    });

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, updateActivity);
      });
    };
  }, [isTimerActive, fileId]);

  // Load PDF if the file is a PDF
  useEffect(() => {
    const loadPdf = async () => {
      if (!fileId) {
        setLoading(false);
        return;
      }

      try {
        // Get file metadata
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: fileData, error: fileError } = await supabase
          .from('uploaded_files')
          .select('*')
          .eq('id', fileId)
          .eq('clerk_user_id', session.user.id)
          .single();

        if (fileError) throw fileError;

        // Check if it's a PDF
        if (fileData.file_type === 'application/pdf') {
          setIsPdf(true);

          // Set PDF.js worker
          pdfjsLib.GlobalWorkerOptions.workerSrc = window.location.origin + '/pdf.worker.min.mjs';

          // Download and load PDF
          const { data: pdfData, error: downloadError } = await supabase.storage
            .from('user-uploads')
            .download(fileData.file_path);

          if (downloadError) throw downloadError;

          const arrayBuffer = await pdfData.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

          const pages: string[] = [];
          const fullPages: string[] = [];
          const dimensions: { width: number; height: number }[] = [];
          const numPages = pdf.numPages;

          // Render each page in both thumbnail and full resolution
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const scale = 0.3; // Thumbnail scale
            const fullScale = 1.5; // Scale for actual canvas insertion
            const viewport = page.getViewport({ scale });
            const fullViewport = page.getViewport({ scale: fullScale });

            // Store actual dimensions for canvas insertion
            dimensions.push({
              width: fullViewport.width,
              height: fullViewport.height
            });

            // Render thumbnail
            const thumbCanvas = document.createElement('canvas');
            const thumbContext = thumbCanvas.getContext('2d');
            if (thumbContext) {
              thumbCanvas.height = viewport.height;
              thumbCanvas.width = viewport.width;
              await page.render({
                canvasContext: thumbContext,
                viewport: viewport,
                canvas: thumbCanvas as unknown as HTMLCanvasElement,
              }).promise;
              pages.push(thumbCanvas.toDataURL('image/png'));
            }

            // Render full resolution
            const fullCanvas = document.createElement('canvas');
            const fullContext = fullCanvas.getContext('2d');
            if (fullContext) {
              fullCanvas.height = fullViewport.height;
              fullCanvas.width = fullViewport.width;
              await page.render({
                canvasContext: fullContext,
                viewport: fullViewport,
                canvas: fullCanvas as unknown as HTMLCanvasElement,
              }).promise;
              fullPages.push(fullCanvas.toDataURL('image/png'));
            }
          }

          setPdfPages(pages);
          setPdfFullPages(fullPages);
          setPdfPageDimensions(dimensions);
        }
      } catch (error) {
        console.error('Error loading PDF:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPdf();
  }, [fileId]);

  // Function to reload chat sessions
  const reloadChatSessions = async () => {
    if (!currentUserId || !fileId) {
      return [];
    }
    
    try {
      setIsLoadingSessions(true);
      
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('id, created_at, title')
        .eq('user_id', currentUserId)
        .eq('file_id', fileId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading chat sessions:', error);
        return [];
      }

      const sessionsToSet = data || [];
      setAvailableChatSessions(sessionsToSet);
      
      return sessionsToSet;
    } catch (error: any) {
      console.error('Error reloading chat sessions:', error);
      return [];
    } finally {
      setIsLoadingSessions(false);
    }
  };


  // Load available chat sessions on mount
  useEffect(() => {
    if (currentUserId && fileId) {
      reloadChatSessions();
    }
  }, [currentUserId, fileId]);


  // Save chat to Supabase
  const saveChatToSupabase = async () => {
    if (!currentUserId || !fileId || chatMessages.length === 0) return;

    try {
      // Create or update session
      let sessionId = currentChatSessionId;
      
      if (!sessionId) {
        // Create new session
        const { data: sessionData, error: sessionError } = await supabase
          .from('ai_chat_sessions')
          .insert({
            user_id: currentUserId,
            file_id: fileId,
            title: null, // Could be made editable later
          })
          .select()
          .single();

        if (sessionError) {
          console.error('Error creating chat session:', sessionError);
          alert(`Error creating chat session: ${sessionError.message || 'Unknown error'}`);
          return;
        }

        if (!sessionData || !sessionData.id) {
          console.error('No session data returned');
          alert('Error: Failed to create chat session');
          return;
        }

        sessionId = sessionData.id;
        setCurrentChatSessionId(sessionId);
      }

      // Delete existing messages for this session
      await supabase
        .from('ai_chat_messages')
        .delete()
        .eq('session_id', sessionId);

      // Insert all messages
      const messagesToInsert = chatMessages.map((msg, index) => ({
        session_id: sessionId,
        role: msg.role,
        content: msg.content,
        message_order: index,
      }));

      const { error: messagesError } = await supabase
        .from('ai_chat_messages')
        .insert(messagesToInsert);

      if (messagesError) {
        console.error('Error saving messages:', messagesError);
        alert(`Error saving messages: ${messagesError.message || 'Unknown error'}`);
        return;
      }

      // Reload sessions list
      await reloadChatSessions();

      // Also save to localStorage as backup
      if (fileId) {
        localStorage.setItem(`chatMessages_${fileId}`, JSON.stringify(chatMessages));
      }

      alert('Chat saved successfully!');
    } catch (error: any) {
      console.error('Error saving chat:', error);
      alert(`Unexpected error saving chat: ${error?.message || 'Unknown error'}`);
    }
  };

  // Load chat from Supabase
  const loadChatFromSupabase = async (sessionId: string) => {
    if (!sessionId) return;

    try {
      const { data: messages, error } = await supabase
        .from('ai_chat_messages')
        .select('role, content')
        .eq('session_id', sessionId)
        .order('message_order', { ascending: true });

      if (error) {
        console.error('Error loading chat messages:', error);
        alert(`Error loading chat: ${error.message || 'Unknown error'}`);
        return;
      }

      if (messages) {
        const formattedMessages = messages.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        }));

        setChatMessages(formattedMessages);
        setCurrentChatSessionId(sessionId);
        
        // Also save to localStorage as backup
        if (fileId) {
          localStorage.setItem(`chatMessages_${fileId}`, JSON.stringify(formattedMessages));
        }
      }
    } catch (error: any) {
      console.error('Error loading chat:', error);
      alert(`Error loading chat: ${error?.message || 'Unknown error'}`);
    }
  };

  // Get display name for chat (title if exists, otherwise formatted date)
  const getChatDisplayName = (session: { id: string; created_at: string; title: string | null }) => {
    return session.title || formatChatDate(session.created_at);
  };

  // Handle opening edit dialog
  const handleEditChatName = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Prevent select from triggering
    const session = availableChatSessions.find(s => s.id === sessionId);
    if (session) {
      setEditingChatId(sessionId);
      setEditingChatTitle(session.title || '');
      setIsEditDialogOpen(true);
    }
  };

  // Update chat title
  const handleUpdateChatTitle = async () => {
    if (!editingChatId || !currentUserId) return;

    try {
      const { error } = await supabase
        .from('ai_chat_sessions')
        .update({ title: editingChatTitle.trim() || null })
        .eq('id', editingChatId)
        .eq('user_id', currentUserId);

      if (error) {
        console.error('Error updating chat title:', error);
        alert('Failed to update chat name');
        return;
      }

      // Update local state
      setAvailableChatSessions(prev =>
        prev.map(session =>
          session.id === editingChatId
            ? { ...session, title: editingChatTitle.trim() || null }
            : session
        )
      );

      setIsEditDialogOpen(false);
      setEditingChatId(null);
      setEditingChatTitle('');
    } catch (error) {
      console.error('Error updating chat title:', error);
      alert('Failed to update chat name');
    }
  };

  // Format date for display
  const formatChatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    // If same day, show relative time with "Today"
    if (dateOnly.getTime() === today.getTime()) {
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);

      if (diffMinutes < 1) {
        return 'Today (just now)';
      } else if (diffMinutes < 60) {
        return `Today (${diffMinutes} ${diffMinutes === 1 ? 'min' : 'mins'} ago)`;
      } else if (diffHours < 24) {
        return `Today (${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago)`;
      } else {
        return 'Today';
      }
    } else if (dateOnly.getTime() === yesterday.getTime()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }
  };

  // Load friends list
  useEffect(() => {
    const loadFriends = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('🔍 No session found');
          return;
        }

        console.log('🔍 Loading friends for user:', session.user.id);

        // Fetch friends from friends table (matching Friends.tsx pattern)
        const { data: friendsData, error: friendsError } = await supabase
          .from('friends')
          .select('friend_id')
          .eq('user_id', session.user.id)
          .eq('status', 'accepted')
          .limit(5);

        console.log('🔍 Friends query result:', { friendsData, friendsError });

        if (friendsError) {
          console.error('❌ Error fetching friends:', friendsError);
          return;
        }

        if (!friendsData || friendsData.length === 0) {
          console.log('⚠️ No friends found');
          return;
        }

        console.log('✅ Found friends:', friendsData.length);

        // Get friend IDs
        const friendIds = friendsData.map((friend) => friend.friend_id);

        console.log('🔍 Friend IDs to fetch:', friendIds);

        // Fetch friend profiles including plan information
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, image_url, email, role, plan, plan_expires_at')
          .in('id', friendIds);

        console.log('🔍 Profiles query result:', { profilesData, profilesError });

        if (profilesError) {
          console.error('❌ Error fetching profiles:', profilesError);
          return;
        }

        console.log('✅ Setting friends:', profilesData?.length || 0);
        setFriends(profilesData || []);
      } catch (error) {
        console.error('❌ Error loading friends:', error);
      }
    };

    loadFriends();
  }, []);

  // Create initial blank scene
  const initialData = {
    elements: [],
    appState: {
      collaborators: [],
      currentItemStrokeColor: '#000000',
      currentItemBackgroundColor: 'transparent',
      currentItemFillStyle: 'solid',
      currentItemStrokeWidth: 1,
      currentItemStrokeStyle: 'solid',
      currentItemRoughness: 1,
      currentItemOpacity: 100,
      currentItemFontFamily: 1,
      currentItemFontSize: 20,
      currentItemTextAlign: 'left',
      currentItemStartArrowhead: null,
      currentItemEndArrowhead: 'arrow',
      scrollX: 0,
      scrollY: 0,
      zoom: { value: 1 },
      currentItemRoundness: 'legacy',
      gridSize: null,
      colorPalette: {}
    },
    files: {}
  };

  // Load saved scene from localStorage (if present)
  const excalidrawStorageKey = getStorageKey(fileId || undefined);
  const savedInitialData = (() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(excalidrawStorageKey) : null;
      if (!raw) {
        console.debug('[DocumentEditor] No saved scene for key:', excalidrawStorageKey);
        return null;
      }
      const parsed = JSON.parse(raw);
      console.debug('[DocumentEditor] Loaded scene', {
        elementsCount: Array.isArray(parsed?.elements) ? parsed.elements.length : 0,
        filesCount: parsed?.files ? Object.keys(parsed.files).length : 0
      });
      return parsed;
    } catch (e) {
      console.warn('[DocumentEditor] Failed parsing saved scene:', e);
      return null;
    }
  })();

  // Persist scene (debounced) on changes
  const persistScene = React.useCallback(
    debounce((elements: any[], appState: any, files: any) => {
      try {
        const data = {
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            currentItemFillStyle: appState.currentItemFillStyle,
            currentItemStrokeColor: appState.currentItemStrokeColor,
            currentItemBackgroundColor: appState.currentItemBackgroundColor,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
          },
          files,
        };
        const serialized = JSON.stringify(data);
        console.debug('[DocumentEditor] Persisting scene', {
          elementsCount: Array.isArray(elements) ? elements.length : 0,
          filesCount: files ? Object.keys(files).length : 0,
          sizeBytes: serialized.length,
          key: excalidrawStorageKey,
        });
        localStorage.setItem(excalidrawStorageKey, serialized);
      } catch (e) {
        console.warn('[DocumentEditor] Failed to save scene (quota/serialization):', e);
      }
    }, 500),
    [excalidrawStorageKey]
  );

  const handleExcalidrawChange = React.useCallback((elements: any[], appState: any, files?: any) => {
    console.debug('[DocumentEditor] Excalidraw onChange', {
      elementsCount: Array.isArray(elements) ? elements.length : 0,
      filesCount: files ? Object.keys(files).length : 0,
    });
    persistScene(elements, appState, files ?? {});
  }, [persistScene]);

  // Fallback polling to persist scene even if onChange doesn't fire on draws
  useEffect(() => {
    if (!excalidrawAPI) return;
    console.debug('[DocumentEditor] Starting scene polling persistence');
    const interval = window.setInterval(() => {
      try {
        const elements = excalidrawAPI.getSceneElements?.() || [];
        const appState = excalidrawAPI.getAppState?.() || {};
        const files = excalidrawAPI.getFiles?.() || {};
        const snapshot = {
          elements,
          appState: {
            viewBackgroundColor: appState.viewBackgroundColor,
            currentItemFillStyle: appState.currentItemFillStyle,
            currentItemStrokeColor: appState.currentItemStrokeColor,
            currentItemBackgroundColor: appState.currentItemBackgroundColor,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
          },
          files,
        };
        const serialized = JSON.stringify(snapshot);
        if (serialized !== lastSerializedRef.current) {
          lastSerializedRef.current = serialized;
          console.debug('[DocumentEditor] Poll-save scene', {
            elementsCount: Array.isArray(elements) ? elements.length : 0,
            filesCount: files ? Object.keys(files).length : 0,
            sizeBytes: serialized.length,
          });
          localStorage.setItem(excalidrawStorageKey, serialized);
        }
      } catch (e) {
        console.warn('[DocumentEditor] Polling persistence error:', e);
      }
    }, 1000);
    return () => {
      window.clearInterval(interval);
      console.debug('[DocumentEditor] Stopped scene polling persistence');
    };
  }, [excalidrawAPI, excalidrawStorageKey]);

  // Calculate visible pages (show 5 at a time, or all if less than 5)
  const maxVisible = Math.min(5, pdfPages.length);
  const visiblePages = pdfPages.slice(scrollPosition, scrollPosition + maxVisible);
  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = scrollPosition + maxVisible < pdfPages.length;

  const handleScrollLeft = () => {
    setScrollPosition(Math.max(0, scrollPosition - 1));
  };

  const handleScrollRight = () => {
    setScrollPosition(Math.min(pdfPages.length - maxVisible, scrollPosition + 1));
  };

  const handlePageClick = (pageIndex: number) => {
    if (!excalidrawAPI) return;

    // Get the full-resolution page and dimensions
    const pageDataUrl = pdfFullPages[pageIndex];
    if (!pageDataUrl) {
      console.error('No full-res page data for index:', pageIndex);
      return;
    }

    const pageDimensions = pdfPageDimensions[pageIndex] || { width: 400, height: 500 };

    // Get current viewport state
    const appState = excalidrawAPI.getAppState();
    const { scrollX, scrollY, zoom } = appState;

    // Calculate position at center of current viewport
    // Account for zoom and scroll to place image in visible area
    const viewportCenterX = -scrollX + (appState.width / 2) / zoom.value;
    const viewportCenterY = -scrollY + (appState.height / 2) / zoom.value;

    // Center the image based on actual dimensions
    const imageX = viewportCenterX - (pageDimensions.width / 2);
    const imageY = viewportCenterY - (pageDimensions.height / 2);

    // Create image element for the clicked page
    const newElement = {
      type: "image",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      id: `page-${pageIndex}-${Date.now()}`,
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: imageX,
      y: imageY,
      strokeColor: "transparent",
      backgroundColor: "transparent",
      width: pageDimensions.width,
      height: pageDimensions.height,
      seed: Math.floor(Math.random() * 1000000),
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: Date.now(),
      link: null,
      locked: false,
      status: "saved",
      fileId: `file-page-${pageIndex}-${Date.now()}`,
      scale: [1, 1],
    };

    // Add the file to Excalidraw
    const fileId = newElement.fileId;
    excalidrawAPI.addFiles([{
      id: fileId,
      dataURL: pageDataUrl,
      mimeType: 'image/png',
      created: Date.now(),
    }]);

    // Add the element to the canvas
    const currentElements = excalidrawAPI.getSceneElements();
    excalidrawAPI.updateScene({
      elements: [...currentElements, newElement],
    });

    console.log(`📄 Added page ${pageIndex + 1} to canvas at position:`, {
      x: newElement.x,
      y: newElement.y,
      viewportCenter: { x: viewportCenterX, y: viewportCenterY }
    });

    // Mark this page as imported
    setImportedPages(prev => new Set(prev).add(pageIndex));
  };

  const getInitials = (friend: Friend) => {
    if (friend.first_name && friend.last_name) {
      return `${friend.first_name[0]}${friend.last_name[0]}`.toUpperCase();
    }
    if (friend.first_name) {
      return friend.first_name[0].toUpperCase();
    }
    return friend.email[0].toUpperCase();
  };

  const getDisplayName = (friend: Friend) => {
    if (friend.first_name && friend.last_name) {
      return `${friend.first_name} ${friend.last_name}`;
    }
    if (friend.first_name) {
      return friend.first_name;
    }
    return friend.email.split('@')[0];
  };

  // Handle chat input drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
    
    // Calculate the offset from the mouse position to the component's top-left corner
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    setChatPosition({
      x: Math.max(0, Math.min(window.innerWidth - 320, newX)), // 320px is approximate component width
      y: Math.max(0, Math.min(window.innerHeight - 80, newY))   // 80px is approximate component height
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Track presence status while on the whiteboard
  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    const setupPresence = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        const channel = supabase.channel("user-presence", {
          config: {
            presence: {
              key: user.id,
            },
          },
        });

        presenceChannelRef.current = channel;

        const trackStatus = async (status: "studying" | "online" | "offline") => {
          try {
            await channel.track({ status, updatedAt: new Date().toISOString() });
          } catch (error) {
            console.warn("[DocumentEditor] Failed to track presence", error);
          }
        };

        const handleVisibilityChange = () => {
          if (!channel) return;
          if (document.visibilityState === "visible") {
            void trackStatus("studying");
          } else {
            void trackStatus("online");
          }
        };

        const handleBeforeUnload = () => {
          void trackStatus("online");
        };

        channel.on("presence", { event: "sync" }, () => {
          // no-op; presence state handled elsewhere
        });

        channel.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await trackStatus("studying");
          }
        });

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("beforeunload", handleBeforeUnload);

        cleanup = () => {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          window.removeEventListener("beforeunload", handleBeforeUnload);
          void trackStatus("online");
          channel.unsubscribe();
          presenceChannelRef.current = null;
        };
      } catch (error) {
        console.warn("[DocumentEditor] Failed to initialise presence", error);
      }
    };

    setupPresence();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  // Handle Command + I keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
        e.preventDefault();
        setShowChatSidebar(!showChatSidebar);
        setShowChatInput(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showChatSidebar]);

  const handleChatPaste = async (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData.items;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check if the pasted item is an image
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        
        const file = item.getAsFile();
        if (!file) return;
        
        // Convert file to base64
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Image = event.target?.result as string;
          if (base64Image) {
            setPendingChatAttachment(base64Image);
            toast.success('Image pasted! Click send to share.');
          }
        };
        reader.onerror = () => {
          toast.error('Failed to process image');
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = chatInput.trim();
    const hasAttachment = !!pendingChatAttachment;
    
    // Allow sending with just text, just image, or both
    if (!question && !hasAttachment) {
      return;
    }

    let dataURL: string | null = null;

    // If there's a pasted attachment, use it; otherwise capture whiteboard
    if (pendingChatAttachment) {
      dataURL = pendingChatAttachment;
      setPendingChatAttachment(null);
    } else if (excalidrawAPI) {
      try {
        let elements = excalidrawAPI.getSceneElements?.() || [];
        const appState = excalidrawAPI.getAppState?.() || {};
        const files = excalidrawAPI.getFiles?.() || {};
        
        // Filter out deleted elements
        elements = elements.filter((el: any) => !el.isDeleted);
        
        // Transform elements to ensure dark colors for light mode export
        const transformedElements = transformElementsForLightExport(elements);
        
        // Log element types for debugging
        const elementTypes = transformedElements.reduce((acc: any, el: any) => {
          acc[el.type] = (acc[el.type] || 0) + 1;
          return acc;
        }, {});
        console.debug('[DocumentEditor] Capturing for chat:', {
          totalElements: transformedElements.length,
          elementTypes
        });
        
        if (!transformedElements || transformedElements.length === 0) {
          console.warn('[DocumentEditor] No elements to capture on whiteboard.');
        }
        
        const canvas = await exportToCanvas({
          elements: transformedElements,
          appState: {
            ...appState,
            exportBackground: true,
            viewBackgroundColor: '#ffffff', // Force white background for consistent export regardless of theme
            exportWithDarkMode: false, // Force light mode colors so text is visible (black text on white/light backgrounds)
          },
          files,
        });
        dataURL = canvas.toDataURL("image/png");
      } catch (error) {
        console.error('[DocumentEditor] Error capturing scene:', error);
        toast.error('Failed to capture whiteboard. Please try again.');
      }
    }

    if (!dataURL && !question) {
      console.warn('[DocumentEditor] Unable to capture whiteboard for chat message.');
      return;
    }

    // Send message with image (or just text if no image)
    if (dataURL) {
      await sendMessageWithImage(question || '', dataURL);
    } else {
      // Fallback: send text-only message (though this shouldn't happen with current flow)
      await sendMessageWithImage(question, '');
    }
    
    setChatInput('');
  };

  const sendMessageWithImage = async (question: string, imageDataURL: string) => {
    const isPastedImage = imageDataURL && imageDataURL.startsWith('data:image');
    
    // Add user message - if it's a pasted image, store it in content
    const userMessageContent = isPastedImage && imageDataURL 
      ? (question ? `${question}\n${imageDataURL}` : imageDataURL)
      : question;
    const userMessage = { role: 'user' as const, content: userMessageContent };
    setChatMessages(prev => {
      const updated: Array<{ role: 'user' | 'assistant'; content: string }> = [...prev, userMessage];
      // Save to localStorage
      if (fileId) {
        localStorage.setItem(`chatMessages_${fileId}`, JSON.stringify(updated));
      }
      return updated;
    });
    setChatInput('');
    setIsChatLoading(true);
    setShowChatInput(false);
    
    // Always open sidebar when sending a message
    setShowChatSidebar(true);

    try {
      // If it's a pasted image, we still need to send it to the backend for analysis
      // Convert image to blob
      const response = await fetch(imageDataURL);
      const blob = await response.blob();
      
      // Create form data with image and prompt
      const formData = new FormData();
      formData.append('image', blob, isPastedImage ? 'pasted-image.png' : 'whiteboard.png');
      const latexInstructions = [
        'Provide a detailed, step-by-step solution.',
        'Number each step (Step 1., Step 2., etc.).',
        'Use LaTeX for all mathematical expressions: inline \(...\), display \[...\], and \boxed{} for final answers.',
        'Keep explanatory text concise but complete.'
      ].join(' ');
      const augmentedPrompt = question 
        ? `${question}\n\n${latexInstructions}`
        : `Analyze this image and provide a detailed explanation.\n\n${latexInstructions}`;
      formData.append('prompt', augmentedPrompt);
      
      // Get session token for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in.');
      }
      
      // Create AbortController for cancellation
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      // Send to backend
      const apiResponse = await fetch(`${BACKEND_URL}/api/analyze-whiteboard`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        },
        body: formData,
        signal: abortController.signal
      });
      
      const data = await apiResponse.json();
      
      if (data.success) {
        const assistantContent = (data.analysis || '').trim();
        const processed = await generateExpandedSteps(assistantContent);
        console.debug('[AI] Original response:', assistantContent);
        console.debug('[AI] Processed response:', processed);
        
        // Track token usage if available
        if (data.tokenUsage) {
          const tokenEntry: TokenUsage = {
            inputTokens: data.tokenUsage.prompt_tokens || 0,
            outputTokens: data.tokenUsage.completion_tokens || 0,
            timestamp: new Date().toISOString(),
            userMessage: question || 'Image analysis',
            assistantMessage: processed.substring(0, 200) // Store first 200 chars for reference
          };
          setTokenLogs(prev => {
            const updated = [...prev, tokenEntry];
            // Save to localStorage
            if (fileId) {
              localStorage.setItem(`tokenLogs_${fileId}`, JSON.stringify(updated));
            }
            return updated;
          });
        }
        
        // Add AI response
        setChatMessages(prev => {
          const updated: Array<{ role: 'user' | 'assistant'; content: string }> = [...prev, { role: 'assistant' as const, content: processed }];
          // Save to localStorage
          if (fileId) {
            localStorage.setItem(`chatMessages_${fileId}`, JSON.stringify(updated));
          }
          return updated;
        });
      } else {
        setChatMessages(prev => {
          const updated: Array<{ role: 'user' | 'assistant'; content: string }> = [...prev, { 
            role: 'assistant' as const,
            content: 'Sorry, I encountered an error: ' + (data.error || 'Unknown error')
          }];
          // Save to localStorage
          if (fileId) {
            localStorage.setItem(`chatMessages_${fileId}`, JSON.stringify(updated));
          }
          return updated;
        });
      }
    } catch (error) {
      // Don't show error if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('[DocumentEditor] Request was cancelled');
        // Remove the user message that was added if request was cancelled
        setChatMessages(prev => {
          const updated = prev.slice(0, -1); // Remove last message (the user message)
          if (fileId) {
            localStorage.setItem(`chatMessages_${fileId}`, JSON.stringify(updated));
          }
          return updated;
        });
        return;
      }
      
      console.error('Error getting AI response:', error);
      setChatMessages(prev => {
        const updated: Array<{ role: 'user' | 'assistant'; content: string }> = [...prev, { 
          role: 'assistant' as const,
          content: 'Sorry, I encountered an error connecting to the AI service.'
        }];
        // Save to localStorage
        if (fileId) {
          localStorage.setItem(`chatMessages_${fileId}`, JSON.stringify(updated));
        }
        return updated;
      });
    } finally {
      setIsChatLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsChatLoading(false);
    }
  };

  const handleAskFriend = async (friend: Friend) => {
    try {
      setCurrentChatFriend(friend);
      setShowFriendChat(true);

      // Capture current workspace as image and send as first message to backend
      if (excalidrawAPI) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        let elements = excalidrawAPI.getSceneElements?.() || [];
        const appState = excalidrawAPI.getAppState?.() || {};
        const files = excalidrawAPI.getFiles?.() || {};
        
        // Filter out deleted elements
        elements = elements.filter((el: any) => !el.isDeleted);
        
        // Transform elements to ensure dark colors for light mode export
        const transformedElements = transformElementsForLightExport(elements);
        
        const canvas = await exportToCanvas({ 
          elements: transformedElements, 
          appState: {
            ...appState,
            exportBackground: true,
            viewBackgroundColor: '#ffffff', // Force white background for consistent export regardless of theme
            exportWithDarkMode: false, // Force light mode colors so text is visible (black text on white/light backgrounds)
          },
          files 
        });
        const dataURL = canvas.toDataURL('image/png');

        setPendingFriendAttachment(dataURL);

        const { data: messagesData, error: messagesError } = await supabase
          .from('friend_messages')
          .select('*')
          .in('sender_id', [user.id, friend.id])
          .in('receiver_id', [user.id, friend.id])
          .order('created_at', { ascending: true });

        if (!messagesError && messagesData) {
          setFriendMessages(messagesData);
        } else if (messagesError) {
          console.warn('[DocumentEditor] Failed to load friend messages:', messagesError);
          setFriendMessages([]);
        }
      }
    } catch (e) {
      console.warn('Failed to initiate friend chat:', e);
      setPendingFriendAttachment(null);
    }
  };

  const summarizeToSteps = (text: string) => text.trim();

  const addTextToCanvas = (rawText: string) => {
    if (!excalidrawAPI) return;
    const appState = excalidrawAPI.getAppState?.() || {};
    const elements = excalidrawAPI.getSceneElements?.() || [];
    const zoom = appState?.zoom?.value || 1;
    const now = Date.now();
    let targetX: number;
    let targetY: number;
    const last = [...elements].filter((e: any) => !e.isDeleted).sort((a: any, b: any) => (b.updated || 0) - (a.updated || 0))[0];
    if (last && typeof last.x === 'number' && typeof last.y === 'number') {
      targetX = last.x + (last.width || 200) + 40;
      targetY = last.y;
    } else {
      const centerX = -(appState.scrollX || 0) + (appState.width ? appState.width / 2 : 600) / zoom;
      const centerY = -(appState.scrollY || 0) + (appState.height ? appState.height / 2 : 400) / zoom;
      targetX = centerX - 200;
      targetY = centerY - 100;
    }
    const text = rawText;
    const numLines = text.split(/\n/).length;
    const fontSize = 20;
    const lineHeightPx = Math.round(fontSize * 1.35);
    const width = 420;
    const height = Math.max(lineHeightPx * numLines + 8, lineHeightPx + 8);
    const newElement = {
      type: "text",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      id: `text-${now}`,
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x: targetX,
      y: targetY,
      strokeColor: "#111827",
      backgroundColor: "transparent",
      width,
      height,
      seed: Math.floor(Math.random() * 1000000),
      groupIds: [],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
      status: "saved",
      text,
      fontSize,
      fontFamily: 1,
      textAlign: "left",
      verticalAlign: "top",
      baseline: lineHeightPx,
      containerId: null,
      originalText: text,
      lineHeight: 1.35,
    } as any;
    const currentElements = excalidrawAPI.getSceneElements?.() || [];
    excalidrawAPI.updateScene({
      elements: [...currentElements, newElement],
    });
  };

  const generateExpandedSteps = async (messageContent: string): Promise<string> => {
    // Try the backend for a high-quality expansion; fallback to local summarizer
    const baseInstructions = [
      'Rewrite the solution as clear numbered steps (Step 1., Step 2., etc.).',
      'Use LaTeX for every mathematical expression (inline \(...\), display \[...\], and \boxed{} for final answers).',
      'Keep explanatory text concise but complete.'
    ].join(' ');
    try {
      const resp = await fetch(`${BACKEND_URL}/api/rewrite-steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: messageContent, instructions: baseInstructions })
      });
      const data = await resp.json();
      if (data && data.success && typeof data.steps === 'string' && data.steps.trim()) {
        return data.steps.trim();
      }
    } catch (e) {
      // ignore and fallback
    }
    return summarizeToSteps(messageContent);
  };

  const stripLatexToPlainText = (input: string) => {
    let output = input;

    // 1) Replace structural LaTeX wrappers but preserve semantic info
    // \boxed{...} → inner text
    output = output.replace(/\\boxed\{([^}]*)\}/g, '$1');

    // \frac{a}{b}, \tfrac{a}{b}, \dfrac{a}{b}, \cfrac{a}{b} → "a / b"
    output = output.replace(/\\(?:frac|tfrac|dfrac|cfrac)\s*\{([^}]*)\}\s*\{([^}]*)\}/g, '$1 / $2');
    // Also handle rare no-brace forms: \frac a b → "a / b"
    output = output.replace(/\\(?:frac|tfrac|dfrac|cfrac)\s+([^\s{}]+)\s+([^\s{}]+)/g, '$1 / $2');

    // \sqrt{a} → "sqrt(a)"
    output = output.replace(/\\sqrt\s*\{([^}]*)\}/g, 'sqrt($1)');

    // Remove inline and display math delimiters \(...\), \[...\]
    output = output.replace(/\\\(|\\\)/g, '');
    output = output.replace(/\\\[|\\\]/g, '');

    // 2) Map common math operators to ASCII equivalents
    output = output.replace(/\\cdot/g, ' * ');
    output = output.replace(/\\times/g, ' * ');
    output = output.replace(/\\pm/g, ' +/- ');
    output = output.replace(/\\leq/g, ' <=');
    output = output.replace(/\\geq/g, ' >=');
    output = output.replace(/\\neq/g, ' != ');
    output = output.replace(/\\Longrightarrow|\\Rightarrow|\\rightarrow/g, ' -> ');

    // 3) Strip any remaining LaTeX commands (best-effort)
    output = output.replace(/\\[a-zA-Z]+/g, '');

    // 4) Normalize whitespace
    output = output.replace(/\s+\n/g, '\n');
    output = output.replace(/\n{3,}/g, '\n\n');
    output = output.replace(/[ \t]{2,}/g, ' ');

    return output.trim();
  };

  const ensureLatexDelimiters = (input: string) => {
    let output = input;
    const inlineTargets = [
      /(\(([^\n()]*\\tfrac[^\n()]*)\))/g,
      /(\(([^\n()]*\\frac[^\n()]*)\))/g,
      /(\(([^\n()]*\\sqrt[^\n()]*)\))/g,
      /(\(([^\n()]*\\boxed[^\n()]*)\))/g,
    ];
    inlineTargets.forEach((regex) => {
      output = output.replace(regex, (_match, _full, inner) => `\\(${inner.replace(/\\\(/g, '(').replace(/\\\)/g, ')')}\\)`);
    });
    // Wrap standalone latex commands not already in delimiters
    output = output.replace(/(^|\s)(\\(?:frac|tfrac|sqrt|boxed|pm|cdot|times|leq|geq|neq)[^\s]*)/g, (_m, prefix, latex) => `${prefix}\\(${latex}\\)`);
    // Normalize whitespace
    output = output.replace(/\s+\n/g, '\n').replace(/\n{2,}/g, '\n\n');
    return output;
  };

  const handleAddWorkToWhiteboard = async (messageContent: string) => {
    // If content is already in plain English format (starts with "Step"), add directly
    // Otherwise, process it through generateExpandedSteps (for backward compatibility with old messages)
    const isAlreadyProcessed = messageContent.trim().toLowerCase().startsWith('step');
    const steps = isAlreadyProcessed ? ensureLatexDelimiters(messageContent) : await generateExpandedSteps(messageContent);
    const plainText = stripLatexToPlainText(steps);
    addTextToCanvas(plainText);
    console.debug('[AI] Added to whiteboard (plain text):', plainText);
  };

  const incrementProblemsSolvedToday = () => {
    try {
      const today = new Date();
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      const yyyyMmDd = `${y}-${m}-${d}`;
      const key = `problemsSolved:${yyyyMmDd}`;
      const prev = parseInt(localStorage.getItem(key) || '0', 10) || 0;
      localStorage.setItem(key, String(prev + 1));
      void syncDailyMetrics();
    } catch (e) {
      // ignore
    }
  };

  const generatePracticeQuestionFromScene = async (): Promise<string> => {
    try {
      if (!excalidrawAPI) return 'Practice Question: Create a related question in plain English based on the main topic shown on the whiteboard.';
      // Prefer backend generation using a capture of the scene
      let elements = excalidrawAPI.getSceneElements?.() || [];
      const appState = excalidrawAPI.getAppState?.() || {};
      const files = excalidrawAPI.getFiles?.() || {};
      
      // Filter out deleted elements
      elements = elements.filter((el: any) => !el.isDeleted);
      
      // Transform elements to ensure dark colors for light mode export
      const transformedElements = transformElementsForLightExport(elements);
      
      const canvas = await exportToCanvas({ 
        elements: transformedElements, 
        appState: {
          ...appState,
          exportBackground: true,
          viewBackgroundColor: '#ffffff', // Force white background for consistent export regardless of theme
          exportWithDarkMode: false, // Force light mode colors so text is visible (black text on white/light backgrounds)
        },
        files 
      });
      
      const makeDataUrl = (maxW: number, quality: number) => {
        const scale = canvas.width > maxW ? maxW / canvas.width : 1;
        const outCanvas = document.createElement('canvas');
        outCanvas.width = Math.max(1, Math.round(canvas.width * scale));
        outCanvas.height = Math.max(1, Math.round(canvas.height * scale));
        const ctx = outCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, 0, outCanvas.width, outCanvas.height);
        }
        return outCanvas.toDataURL('image/jpeg', quality);
      };

      let dataURL = makeDataUrl(1400, 0.8);
      const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant')?.content || '';

      let resp = await fetch(`${BACKEND_URL}/api/generate-question`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataURL,
          instructions: 'Create ONE new related practice problem in plain English only. No LaTeX/markdown/symbols/emojis. Use ASCII (19/5, sqrt(x)). Output only the problem statement. Make it self-contained and solvable.',
          context: lastAssistant
        })
      });
      console.debug('[generate-question] Response status', resp.status, resp.ok);

      // Auto-retry on 413 with smaller size/quality
      if (resp.status === 413) {
        console.warn('[generate-question] 413 received, retrying with smaller payload');
        dataURL = makeDataUrl(900, 0.65);
        resp = await fetch(`${BACKEND_URL}/api/generate-question`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataURL,
            instructions: 'Create ONE new related practice problem in plain English only. No LaTeX/markdown/symbols/emojis. Use ASCII (19/5, sqrt(x)). Output only the problem statement. Make it self-contained and solvable.',
            context: lastAssistant
          })
        });
        console.debug('[generate-question] Retry response status', resp.status, resp.ok);
      }

      const data = await resp.json().catch(() => ({}));
      console.debug('[generate-question] Response body', data);
      if (data && data.success && typeof data.question === 'string' && data.question.trim()) {
        const q = data.question.trim();
        // Ensure it reads like a problem; if not, append a question mark for readability
        return /[?]$/.test(q) ? q : q;
      }
      console.warn('[generate-question] Falling back, invalid data:', data);
    } catch (e) {
      console.warn('[generate-question] Error, falling back:', e);
    }
    // Fallback: heuristic based on the latest assistant message/topic.
    // We now return a concrete, human-readable problem instead of an instruction.
    try {
      const lastAssistant = [...chatMessages].reverse().find(m => m.role === 'assistant')?.content || '';
      const extractTopic = (input: string) => {
        let plain = input
          .replace(/\\boxed\{([^}]*)\}/g, '$1')
          .replace(/\\[a-zA-Z]+/g, ' ')
          .replace(/\$\$?[^$]*\$\$?/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!plain) return '';
        const match = plain.match(/([A-Za-z0-9\/\- ]{10,120})/);
        return (match ? match[0] : plain).trim();
      };
      const topic = extractTopic(lastAssistant).toLowerCase();
      if (topic) {
        if (topic.includes('slope')) {
          // Concrete example problem for slope-related topics
          return 'A line passes through the points (2, 5) and (8, 17). Compute the slope of this line.';
        }
        // Generic concrete problem template for other topics
        return `Based on your current notes, create a self-contained practice problem about this topic: ${topic}. Clearly state the question in plain English so it can be solved without seeing the original whiteboard.`;
      }
    } catch (_) {}
    return 'Create a clear, self-contained practice problem that matches the current topic you are studying. State the question in plain English so it can be solved without seeing the whiteboard.';
  };

  const handleAddPracticeQuestion = async () => {
    try {
      setIsGeneratingQuestion(true);
    const question = await generatePracticeQuestionFromScene();
    addTextToCanvas(question);
    incrementProblemsSolvedToday();
    } finally {
      setIsGeneratingQuestion(false);
    }
  };


  // Format time for display
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  };

  return (
    <>
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Back button overlay */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          variant="outline"
          onClick={() => navigate('/app')}
          size="sm"
          className="bg-card dark:bg-card shadow-md border-border"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* Friends List Overlay */}
      {showFriends && (
        <div className="absolute top-16 left-4 z-50">
          <div className="bg-white/95 dark:bg-card/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 dark:border-border w-64">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 dark:border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-home-primary" />
                <div className="flex flex-col leading-tight">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-home-foreground">Stuck on a problem?</h3>
                  <span className="text-xs text-gray-600 dark:text-gray-400">Ask a friend!</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFriends(false)}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>

            {/* Friends List */}
            <div className="p-2 max-h-80 overflow-y-auto">
              {friends.length > 0 ? (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-2 rounded-lg transition-colors"
                    >
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={friend.image_url || undefined} alt={getDisplayName(friend)} />
                        <AvatarFallback className="bg-home-primary text-white text-xs">
                          {getInitials(friend)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-home-foreground truncate">
                          {getDisplayName(friend)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Ask for help</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {(() => {
                          const currentPlan = userPlan || 'free';
                          const isCurrentUserAdmin = currentPlan === 'admin';
                          const currentEffectivePlan = isCurrentUserAdmin ? 'admin' : currentPlan;
                          const canUseVoiceCalls = isCurrentUserAdmin || (currentEffectivePlan === 'plus' || currentEffectivePlan === 'pro');
                          
                          const friendPlan = friend.plan || 'free';
                          const isFriendAdmin = friend.role === 'admin';
                          let friendEffectivePlan = friendPlan;
                          if (friend.plan_expires_at && friendPlan !== 'free') {
                            const expiresAt = new Date(friend.plan_expires_at);
                            const now = new Date();
                            if (expiresAt < now) {
                              friendEffectivePlan = 'free';
                            }
                          }
                          const friendCanReceiveCalls = isFriendAdmin || (friendEffectivePlan === 'plus' || friendEffectivePlan === 'pro');
                          const isDisabled = !canUseVoiceCalls || !friendCanReceiveCalls;
                          
                          let tooltipText = 'Call friend';
                          if (!canUseVoiceCalls) {
                            tooltipText = 'Upgrade to Plus or Pro plan for voice call integration';
                          } else if (!friendCanReceiveCalls) {
                            tooltipText = 'This friend cannot receive calls (Free plan)';
                          }

                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Phone 
                                    className={`w-7 h-7 p-1.5 rounded-md transition-all ${
                                      isDisabled 
                                        ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed opacity-50 pointer-events-auto' 
                                        : 'text-gray-400 dark:text-gray-500 hover:text-home-primary hover:bg-home-primary/10 dark:hover:bg-home-primary/20 cursor-pointer hover:scale-110'
                                    }`}
                                    onClick={async () => {
                                      if (!canUseVoiceCalls) {
                                        alert('Voice calls are only available for Plus and Pro plans. Please upgrade your plan to use this feature.');
                                        return;
                                      }
                                      if (!friendCanReceiveCalls) {
                                        alert(`${getDisplayName(friend)} cannot receive calls because they are on the Free plan. Voice calls are only available for Plus and Pro plans.`);
                                        return;
                                      }
                                      try {
                                        await initiateCall(friend.id, getDisplayName(friend), friend.image_url);
                                      } catch (error: any) {
                                        console.error('Failed to initiate call:', error);
                                        alert(`Failed to start call: ${error.message || 'Unknown error'}`);
                                      }
                                    }}
                                  />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{tooltipText}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                        <MessageSquare 
                          className="w-7 h-7 text-gray-400 dark:text-gray-500 hover:text-home-primary hover:bg-home-primary/10 dark:hover:bg-home-primary/20 p-1.5 rounded-md transition-all cursor-pointer hover:scale-110"
                          onClick={() => handleAskFriend(friend)}
                        />
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <UserPlus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No friends to invite</p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => navigate('/friends')}
                    className="text-home-primary mt-2"
                  >
                    Find friends
                  </Button>
                </div>
              )}
            </div>

            {/* View All Button */}
            {friends.length > 0 && (
              <div className="p-2 border-t border-gray-200 dark:border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/friends')}
                  className="w-full text-home-primary hover:bg-home-primary/10"
                >
                  View all friends
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

            {/* Toggle Chat Input Button */}
            <div className="absolute top-4 right-4 z-50 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (showChatSidebar) {
                    // If sidebar is open, close it
                    setShowChatSidebar(false);
                    setShowChatInput(false);
                  } else {
                    // Always open sidebar directly
                    setShowChatSidebar(true);
                    setShowChatInput(false);
                  }
                }}
                className={`bg-card dark:bg-card shadow-md border-border ${showChatSidebar ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' : ''}`}
                title={showChatSidebar ? "Close chat" : "Open chat"}
              >
                <BotMessageSquare className="w-4 h-4" />
              </Button>
            </div>

            {/* Toggle Friends Button when hidden */}
            {!showFriends && (
              <div className="absolute top-16 left-4 z-50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFriends(true)}
                  className="bg-card dark:bg-card shadow-md border-border"
                >
                  <Users className="w-4 h-4" />
                </Button>
              </div>
            )}

      {/* Movable Chat Input - Removed, using sidebar instead */}
      {false && showChatInput && (
        <div
          className="fixed z-50"
          style={{
            left: `${chatPosition.x}px`,
            top: `${chatPosition.y}px`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={handleChatSubmit} className="flex items-center">
            <div className="relative bg-gray-900 dark:bg-gray-800 border border-gray-700 dark:border-gray-600 rounded-full px-4 py-3 flex items-center gap-3 shadow-lg min-w-80">
              {/* Draggable handle area - left side */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-8 cursor-grab active:cursor-grabbing flex items-center justify-center"
                onMouseDown={handleMouseDown}
              >
                <Move className="w-4 h-4 text-gray-400 dark:text-gray-300" />
              </div>
              
              {/* Input field */}
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPaste={handleChatPaste}
                placeholder="Ask a question about the whiteboard..."
                className="bg-transparent text-gray-200 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 flex-1 outline-none text-sm ml-8"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleChatSubmit(e as any);
                  }
                }}
              />
              
              {/* Command key icon */}
              <div className="flex items-center gap-1 text-gray-400 dark:text-gray-300 text-xs">
                <Command className="w-3 h-3" />
                <span>+ I</span>
              </div>
              
              {/* Send/Stop button */}
              {isChatLoading ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStopResponse();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white rounded-full p-2 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-full p-2 transition-colors"
                  disabled={!chatInput.trim()}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* PDF Page Scroller Overlay */}
      {isPdf && pdfPages.length > 0 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-50">
          {isPdfScrollerMinimized ? (
            // Minimized state - compact button
            <Button
              variant="outline"
              onClick={() => setIsPdfScrollerMinimized(false)}
              className="bg-white/95 dark:bg-card/95 backdrop-blur-sm shadow-xl border border-gray-200 dark:border-border hover:bg-white dark:hover:bg-card"
            >
              <ChevronUp className="w-4 h-4 mr-2" />
              Select from {pdfPages.length} {pdfPages.length === 1 ? 'page' : 'pages'}
            </Button>
          ) : (
            // Expanded state - full scroller
            <div className="bg-white/95 dark:bg-card/95 backdrop-blur-sm rounded-lg shadow-xl p-3 border border-gray-200 dark:border-border">
              <div className="flex items-center gap-2">
                {/* Left scroll button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleScrollLeft}
                  disabled={!canScrollLeft}
                  className="h-8 w-8"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                {/* PDF Page Thumbnails */}
                <div className="flex gap-2 items-center">
                  {visiblePages.map((pageDataUrl, index) => {
                    const actualPageIndex = scrollPosition + index;
                    const isImported = importedPages.has(actualPageIndex);
                    return (
                      <div
                        key={actualPageIndex}
                        className={`relative group cursor-pointer hover:scale-105 transition-transform ${isImported ? 'opacity-50' : ''}`}
                        onClick={() => handlePageClick(actualPageIndex)}
                        title={`Click to add page ${actualPageIndex + 1} to canvas`}
                      >
                        <img
                          src={pageDataUrl}
                          alt={`Page ${actualPageIndex + 1}`}
                          className={`h-24 w-auto rounded border-2 shadow-sm transition-colors ${
                            isImported 
                              ? 'border-gray-400 grayscale' 
                              : 'border-gray-300 hover:border-home-primary'
                          }`}
                        />
                        <div className={`absolute bottom-0 left-0 right-0 text-white text-xs text-center py-1 rounded-b transition-colors ${
                          isImported 
                            ? 'bg-gray-600/70' 
                            : 'bg-black/70 group-hover:bg-home-primary'
                        }`}>
                          Page {actualPageIndex + 1}
                          {isImported && <span className="block text-[10px] mt-0.5">imported</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right scroll button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleScrollRight}
                  disabled={!canScrollRight}
                  className="h-8 w-8"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>

                {/* Minimize button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsPdfScrollerMinimized(true)}
                  className="h-8 w-8 ml-2"
                >
                  <ChevronDown className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Study Timer */}
      <div className="absolute bottom-4 right-4 z-50">
        {isTimerMinimized ? (
          // Minimized state - just icon
          <div 
            className={`bg-white/95 dark:bg-card/95 backdrop-blur-sm rounded-full shadow-xl border border-gray-200 dark:border-border p-2 cursor-pointer ${!isTimerActive ? 'opacity-60' : ''}`}
            onClick={() => setIsTimerMinimized(false)}
            title={`${formatTime(totalStudyTime)} - ${isTimerActive ? 'Studying' : 'Paused'}`}
          >
            <Timer className={`w-4 h-4 ${isTimerActive ? 'text-green-600 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`} />
          </div>
        ) : (
          // Expanded state - full timer
          <div className={`bg-white/95 dark:bg-card/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 dark:border-border px-3 py-2 flex items-center gap-2 ${!isTimerActive ? 'opacity-60' : ''}`}>
            <Timer className={`w-4 h-4 ${isTimerActive ? 'text-green-600 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`} />
            <div className="flex flex-col cursor-pointer" onClick={() => setIsTimerMinimized(true)}>
              <span className="text-sm font-semibold text-gray-900 dark:text-home-foreground">
                {formatTime(totalStudyTime)}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isTimerActive ? 'Studying' : 'Paused'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chat Sidebar (AI only) */}
      {showChatSidebar && (
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gray-50/95 dark:bg-home-surface/95 backdrop-blur-sm shadow-xl border-l border-gray-200 dark:border-border z-[100] flex flex-col transition-all duration-300 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <BotMessageSquare className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0" />
                <h3 className="font-semibold text-gray-900 dark:text-home-foreground flex-shrink-0">AI Chat</h3>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {availableChatSessions.length > 0 && (
                    <Select
                      key={`chat-select-${availableChatSessions.length}-${availableChatSessions.map(s => s.id).join('-')}`}
                      value={currentChatSessionId || 'new'}
                      onValueChange={(value) => {
                        if (value === 'new') {
                          setCurrentChatSessionId(null);
                          setChatMessages([]);
                          if (fileId) {
                            localStorage.removeItem(`chatMessages_${fileId}`);
                          }
                        } else {
                          loadChatFromSupabase(value);
                        }
                      }}
                    >
                      <SelectTrigger className="h-9 w-[200px] text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                        <SelectValue placeholder="Select chat">
                          {currentChatSessionId 
                            ? (() => {
                                const session = availableChatSessions.find(s => s.id === currentChatSessionId);
                                return session ? getChatDisplayName(session) : 'New Chat';
                              })()
                            : 'New Chat'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent 
                        className="z-[200]"
                        position="popper"
                      >
                        <SelectItem value="new">New Chat</SelectItem>
                        {availableChatSessions.map((session) => (
                          <div key={session.id} className="group relative">
                            <SelectItem value={session.id} className="pr-8">
                              <span className="truncate">{getChatDisplayName(session)}</span>
                            </SelectItem>
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-accent rounded"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEditChatName(e, session.id);
                              }}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {availableChatSessions.length === 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">No saved chats</span>
                  )}
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowChatSidebar(false);
                }}
                className="h-8 w-8 p-0 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8">
                <BotMessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400 dark:text-gray-500 opacity-50" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Start a conversation</p>
              </div>
            ) : (
              <>
                {chatMessages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-lg px-3 py-3 space-y-2 ${
                        message.role === 'user'
                          ? 'bg-blue-600 dark:bg-blue-500 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="w-full">
                          <div className="text-sm space-y-3">
                            <MathText text={message.content} />
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddWorkToWhiteboard(message.content)}
                            className="mt-2 w-full text-xs"
                          >
                            <Plus className="w-3 h-3 mr-1.5" />
                            Add Work to Whiteboard
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleAddPracticeQuestion}
                            disabled={isGeneratingQuestion}
                            className="mt-2 w-full text-[10px] leading-tight py-1"
                          >
                            {isGeneratingQuestion ? (
                              <>
                                <Spinner size="xs" className="mr-1.5" />
                                Generating Practice Question...
                              </>
                            ) : (
                              <>
                            <Plus className="w-3 h-3 mr-1.5" />
                            Add Practice Question to Whiteboard
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        (() => {
                          // Check if message contains an image (either starts with data:image or contains it)
                          const imageIndex = message.content.indexOf('data:image');
                          const imageUrl = imageIndex !== -1 
                            ? message.content.substring(imageIndex)
                            : null;
                          const textContent = imageUrl 
                            ? message.content.substring(0, imageIndex).trim()
                            : message.content;
                          
                          return (
                            <div className="space-y-2">
                              {textContent && (
                                <p className="text-sm whitespace-pre-wrap">{textContent}</p>
                              )}
                              {imageUrl && (
                                <img 
                                  src={imageUrl} 
                                  alt="User attachment" 
                                  className="rounded-md max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" 
                                  onClick={() => setExpandedChatImage(imageUrl)}
                                />
                              )}
                            </div>
                          );
                        })()
                      )}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-4 py-2 flex items-center gap-2">
                      <Spinner size="sm" className="text-gray-600 dark:text-gray-400" />
                      <p className="text-sm">Thinking...</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 dark:border-border">
            {/* Image Preview */}
            {pendingChatAttachment && (
              <div className="mb-3 px-1">
                <div className="border rounded-lg p-2 bg-muted/40 inline-flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Image Preview
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 p-0"
                      onClick={() => setPendingChatAttachment(null)}
                      aria-label="Remove attachment"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="rounded-md border overflow-hidden">
                    <img
                      src={pendingChatAttachment}
                      alt="Attached image"
                      className="w-44 h-auto block cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setExpandedChatImage(pendingChatAttachment)}
                    />
                  </div>
                </div>
              </div>
            )}
            
            <form onSubmit={handleChatSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onPaste={handleChatPaste}
                placeholder={pendingChatAttachment ? "Add a message for the AI..." : (chatMessages.length === 0 ? "Ask a question about the whiteboard..." : "Ask a follow-up question...")}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-background dark:bg-input text-foreground"
                disabled={isChatLoading}
              />
              {isChatLoading ? (
                <Button
                  type="button"
                  onClick={handleStopResponse}
                  className="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white"
                >
                  <X className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={(!chatInput.trim() && !pendingChatAttachment)}
                  className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </form>
            {chatMessages.length > 0 && (
              <div className="mt-1.5 flex gap-0.5 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={saveChatToSupabase}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 h-6 px-1.5 py-0 hover:bg-transparent"
                >
                  <Save className="w-3 h-3" />
                  <span className="ml-1">Save Chat</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm('Clear all chat messages?')) {
                      setChatMessages([]);
                      setCurrentChatSessionId(null);
                      if (fileId) {
                        localStorage.removeItem(`chatMessages_${fileId}`);
                      }
                    }
                  }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 h-6 px-1.5 py-0 hover:bg-transparent"
                >
                  <Eraser className="w-3 h-3" />
                  <span className="ml-1">Clear Conversation</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTokenLog(true)}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 h-6 px-1.5 py-0 hover:bg-transparent"
                >
                  <FileText className="w-3 h-3" />
                  <span className="ml-1">Token Log</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full page Excalidraw */}
      <div className="absolute inset-0 excalidraw-wrapper" style={{ width: "100%", height: "100%" }}>
        <div className={theme === 'dark' ? 'excalidraw theme--dark' : 'excalidraw'}>
        <Excalidraw
          initialData={savedInitialData ?? initialData}
          onChange={handleExcalidrawChange}
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          theme={theme === 'dark' ? 'dark' : 'light'}
        />
        </div>
      </div>

      {/* Token Usage Log Dialog - Higher z-index to appear above chat */}
      {showTokenLog && (
        <style>{`
          [data-radix-dialog-overlay] {
            z-index: 9999 !important;
          }
          [data-radix-dialog-content] {
            z-index: 9999 !important;
          }
          .token-log-scrollable {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
          }
          .token-log-scrollable::-webkit-scrollbar {
            display: none; /* Chrome, Safari, Opera */
          }
        `}</style>
      )}
      <Dialog open={showTokenLog} onOpenChange={setShowTokenLog}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col" style={{ zIndex: 9999 }}>
          <DialogHeader>
            <DialogTitle>Token Usage Log</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-6 token-log-scrollable">
            {tokenLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No token usage data available yet.
              </div>
            ) : (
              <div className="space-y-4 pr-2">
                <div className="sticky top-0 bg-background dark:bg-card border-b pb-2 mb-4 z-10">
                  <div className="grid grid-cols-5 gap-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <div>Timestamp</div>
                    <div>Input Tokens</div>
                    <div>Output Tokens</div>
                    <div>Total</div>
                    <div>Estimated Cost</div>
                  </div>
                </div>
                <div className="space-y-3">
                  {tokenLogs.slice().reverse().map((log, index) => {
                    const inputCost = log.inputTokens * 0.00000025;
                    const outputCost = log.outputTokens * 0.000002;
                    const totalCost = inputCost + outputCost;
                    return (
                      <div
                        key={index}
                        className="grid grid-cols-5 gap-4 text-sm border-b border-gray-200 dark:border-gray-700 pb-3 last:border-0"
                      >
                        <div className="text-gray-600 dark:text-gray-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">
                          {log.inputTokens.toLocaleString()}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">
                          {log.outputTokens.toLocaleString()}
                        </div>
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {(log.inputTokens + log.outputTokens).toLocaleString()}
                        </div>
                        <div className="text-gray-700 dark:text-gray-300">
                          ${totalCost.toFixed(8)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Total Tokens Used:</span>
                    <span className="font-bold text-lg text-gray-900 dark:text-gray-100">
                      {tokenLogs.reduce((sum, log) => sum + log.inputTokens + log.outputTokens, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-gray-600 dark:text-gray-400">Total Input Tokens:</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {tokenLogs.reduce((sum, log) => sum + log.inputTokens, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="text-gray-600 dark:text-gray-400">Total Output Tokens:</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {tokenLogs.reduce((sum, log) => sum + log.outputTokens, 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm mt-2">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">Total Estimated Cost:</span>
                    <span className="font-bold text-lg text-gray-900 dark:text-gray-100">
                      ${(
                        tokenLogs.reduce((sum, log) => sum + log.inputTokens * 0.00000025 + log.outputTokens * 0.000002, 0)
                      ).toFixed(8)}
                    </span>
                  </div>
                  {/* Plan-based usage progress bar */}
                  {(() => {
                    const totalCost = tokenLogs.reduce(
                      (sum, log) => sum + log.inputTokens * 0.00000025 + log.outputTokens * 0.000002,
                      0
                    );
                    
                    // Define max dollar limits based on plan
                    const maxDollarLimits: Record<string, number> = {
                      free: 1,
                      plus: 5,
                      pro: 10,
                      admin: Infinity,
                    };
                    
                    const maxLimit = userPlan ? (maxDollarLimits[userPlan] ?? 1) : 1;
                    const progressPercentage = maxLimit === Infinity ? 0 : Math.min((totalCost / maxLimit) * 100, 100);
                    const planDisplayName = userPlan === 'admin' ? 'Admin' : userPlan ? userPlan.charAt(0).toUpperCase() + userPlan.slice(1) : 'Free';
                    
                    if (maxLimit === Infinity) {
                      return null; // Don't show progress bar for admin/unlimited plans
                    }
                    
                    return (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex justify-between items-center text-sm mb-2">
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {planDisplayName} Plan Usage Limit
                          </span>
                          <span className={`font-semibold ${
                            progressPercentage >= 90 
                              ? 'text-red-600 dark:text-red-400' 
                              : progressPercentage >= 70 
                              ? 'text-yellow-600 dark:text-yellow-400' 
                              : 'text-gray-700 dark:text-gray-300'
                          }`}>
                            ${totalCost.toFixed(2)} / ${maxLimit.toFixed(2)}
                          </span>
                        </div>
                        <Progress 
                          value={progressPercentage} 
                          className={`h-3 ${
                            progressPercentage >= 90 
                              ? 'bg-red-100 dark:bg-red-900/30' 
                              : progressPercentage >= 70 
                              ? 'bg-yellow-100 dark:bg-yellow-900/30' 
                              : ''
                          }`}
                        />
                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>{progressPercentage.toFixed(1)}% of limit used</span>
                          {progressPercentage >= 90 && (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              Approaching limit
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTokenLog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Friend Chat Modal */}
      {showFriendChat && currentChatFriend && (
        <FriendChat
          friendId={currentChatFriend.id}
          friendName={getDisplayName(currentChatFriend)}
          initialMessages={friendMessages}
          attachment={pendingFriendAttachment}
          onClearAttachment={() => setPendingFriendAttachment(null)}
          canAttachWhiteboard={true}
          onClose={() => {
            setShowFriendChat(false);
            setPendingFriendAttachment(null);
            setFriendMessages([]);
          }}
        />
      )}


      {/* Edit Chat Name Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Chat Name</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={editingChatTitle}
              onChange={(e) => setEditingChatTitle(e.target.value)}
              placeholder="Enter chat name..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleUpdateChatTitle();
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setEditingChatId(null);
              setEditingChatTitle('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateChatTitle}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expanded Chat Image Dialog */}
      {expandedChatImage && (
        <style>{`
          [data-radix-dialog-overlay] {
            z-index: 200 !important;
          }
          [data-radix-dialog-content] {
            z-index: 200 !important;
          }
        `}</style>
      )}
      <Dialog open={!!expandedChatImage} onOpenChange={(open) => !open && setExpandedChatImage(null)}>
        <DialogContent className="max-w-6xl max-h-[95vh] p-0 bg-transparent border-none shadow-none !z-[200]">
          {expandedChatImage && (
            <div className="relative w-full h-full flex items-center justify-center p-4">
              <img
                src={expandedChatImage}
                alt="Expanded image"
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
    </>
  );
};

export default DocumentEditor;

