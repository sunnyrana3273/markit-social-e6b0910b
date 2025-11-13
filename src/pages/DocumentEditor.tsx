import React, { useState, useEffect, useRef } from 'react';
import { Excalidraw } from "@excalidraw/excalidraw";
import { exportToCanvas } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MessageSquare, Users, Send, Command, Move, UserPlus, Timer, X, Sparkles, Plus } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { FriendChat } from '@/components/FriendChat';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import * as pdfjsLib from 'pdfjs-dist';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { RealtimeChannel } from "@supabase/supabase-js";
import { useTheme } from "@/contexts/ThemeContext";

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
                  dangerouslySetInnerHTML={{ __html: processedText }}
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
        // Check if paragraph contains block math (centered equations)
        const hasBlockMath = paraResult.some((node: any) => 
          node?.type === 'div' && node?.props?.className?.includes('text-center')
        );
        
        if (hasBlockMath || para.trim().startsWith('**') || /^Step \d+\.?/i.test(para.trim())) {
          // Block-level content (equations, headings)
          result.push(
            <div key={`block-para-${paraIdx}`} className="mb-2">
              {paraResult}
            </div>
          );
        } else {
          // Inline/regular paragraph
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
}

const DocumentEditor: React.FC = () => {
  const navigate = useNavigate();
  const { fileId } = useParams();
  const { theme } = useTheme();
  const presenceChannelRef = React.useRef<RealtimeChannel | null>(null);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const [pdfPages, setPdfPages] = useState<string[]>([]); // Thumbnails for display
  const [pdfFullPages, setPdfFullPages] = useState<string[]>([]); // Full-res for canvas insertion
  const [pdfPageDimensions, setPdfPageDimensions] = useState<{ width: number; height: number }[]>([]);
  const [isPdf, setIsPdf] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showFriends, setShowFriends] = useState(true);
  const [isPdfScrollerMinimized, setIsPdfScrollerMinimized] = useState(false);
  const [showChatInput, setShowChatInput] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(() => {
    // Load saved chat messages from localStorage
    const savedMessages = localStorage.getItem(`chatMessages_${fileId}`);
    return savedMessages ? JSON.parse(savedMessages) : [];
  });
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [currentChatFriend, setCurrentChatFriend] = useState<Friend | null>(null);
  const [showFriendChat, setShowFriendChat] = useState(false);
  const [friendMessages, setFriendMessages] = useState<Array<{ id: string; sender_id: string; receiver_id: string; message: string; created_at: string; read_at: string | null }>>([]);
  const [pendingFriendAttachment, setPendingFriendAttachment] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chatPosition, setChatPosition] = useState({ x: 50, y: window.innerHeight - 120 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

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
  const [isTimerMinimized, setIsTimerMinimized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const lastSyncedMetricsRef = useRef<{ date: string; minutes: number; problems: number } | null>(null);
  
  // Capture preview state removed

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

      const toDate = (s: string) => {
        const [Y, M, D] = s.split('-').map(Number);
        return new Date(Y, (M || 1) - 1, D || 1);
      };

      let nextCount = currentCount;
      if (!lastDate) {
        nextCount = 1;
      } else {
        const last = toDate(lastDate);
        const diffDays = Math.floor((new Date(yyyy, parseInt(mm, 10) - 1, parseInt(dd, 10)).getTime() - last.getTime()) / 86400000);
        if (diffDays === 0) {
          // same day: no change
          nextCount = currentCount || 1;
        } else if (diffDays === 1) {
          nextCount = currentCount + 1;
        } else if (diffDays > 1) {
          nextCount = 1;
        } else {
          // If clock went backwards, keep current
          nextCount = Math.max(currentCount, 1);
        }
      }

      localStorage.setItem('studyStreak:lastDate', todayStr);
      localStorage.setItem('studyStreak:count', String(nextCount));
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
      } catch (err) {
        console.error('[DocumentEditor] Unexpected error loading user for metrics sync:', err);
      }
    };

    void loadCurrentUser();
  }, [navigate]);

  useEffect(() => {
    if (!excalidrawAPI) return;

    const captureChannel = new BroadcastChannel('whiteboard-capture');

    captureChannel.onmessage = async (event) => {
      const payload = event.data as { type?: string; requestId?: string };
      if (!payload || payload.type !== 'capture-request' || !payload.requestId) return;

      try {
        const elements = excalidrawAPI.getSceneElements?.() || [];
        const appState = excalidrawAPI.getAppState?.() || {};
        const canvas = await exportToCanvas({
          elements,
          appState,
          files: excalidrawAPI.getFiles?.() || {},
        });
        const dataURL = canvas.toDataURL('image/png');
        captureChannel.postMessage({ requestId: payload.requestId, image: dataURL });
      } catch (error) {
        console.error('[DocumentEditor] Failed to capture whiteboard for attachment:', error);
        captureChannel.postMessage({ requestId: payload.requestId, error: 'Unable to capture whiteboard preview.' });
      }
    };

    return () => {
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

        // Fetch friend profiles
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, image_url, email')
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
        setShowChatInput(!showChatInput);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showChatInput]);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const question = chatInput.trim();
    if (!question) {
      return;
    }

    let dataURL: string | null = null;

    if (excalidrawAPI) {
      try {
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const canvas = await exportToCanvas({
          elements,
          appState,
          files: excalidrawAPI.getFiles(),
        });
        dataURL = canvas.toDataURL("image/png");
      } catch (error) {
        console.error('Error capturing scene:', error);
      }
    }

    if (!dataURL) {
      console.warn('[DocumentEditor] Unable to capture whiteboard for chat message.');
      return;
    }

    await sendMessageWithImage(question, dataURL);
  };

  const sendMessageWithImage = async (question: string, imageDataURL: string) => {

    // Add user message
    const userMessage = { role: 'user' as const, content: question };
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
    
    // Smoothly open sidebar
    setTimeout(() => {
      setShowChatSidebar(true);
    }, 100);

    try {
      // Convert captured image to blob
      const response = await fetch(imageDataURL);
      const blob = await response.blob();
      
      // Create form data with image and prompt
      const formData = new FormData();
      formData.append('image', blob, 'whiteboard.png');
      const latexInstructions = [
        'Provide a detailed, step-by-step solution.',
        'Number each step (Step 1., Step 2., etc.).',
        'Use LaTeX for all mathematical expressions: inline \(...\), display \[...\], and \boxed{} for final answers.',
        'Keep explanatory text concise but complete.'
      ].join(' ');
      const augmentedPrompt = `${question}\n\n${latexInstructions}`;
      formData.append('prompt', augmentedPrompt);
      
      // Send to backend
      const apiResponse = await fetch('http://localhost:3001/api/analyze-whiteboard', {
        method: 'POST',
        body: formData
      });
      
      const data = await apiResponse.json();
      
      if (data.success) {
        const assistantContent = (data.analysis || '').trim();
        const processed = await generateExpandedSteps(assistantContent);
        console.debug('[AI] Original response:', assistantContent);
        console.debug('[AI] Processed response:', processed);
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
        const elements = excalidrawAPI.getSceneElements();
        const appState = excalidrawAPI.getAppState();
        const files = excalidrawAPI.getFiles();
        const canvas = await exportToCanvas({ elements, appState, files });
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
      const resp = await fetch('http://localhost:3001/api/rewrite-steps', {
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
    addTextToCanvas(steps);
    console.debug('[AI] Added to whiteboard:', steps);
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
      const elements = excalidrawAPI.getSceneElements?.() || [];
      const appState = excalidrawAPI.getAppState?.() || {};
      const files = excalidrawAPI.getFiles?.() || {};
      const canvas = await exportToCanvas({ elements, appState, files });
      
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
      let resp = await fetch('http://localhost:3001/api/generate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataURL,
          instructions: 'Create ONE new related practice problem in plain English only. No LaTeX/markdown/symbols/emojis. Use ASCII (19/5, sqrt(x)). Output only the problem statement. Make it self-contained and solvable.'
        })
      });
      console.debug('[generate-question] Response status', resp.status, resp.ok);

      // Auto-retry on 413 with smaller size/quality
      if (resp.status === 413) {
        console.warn('[generate-question] 413 received, retrying with smaller payload');
        dataURL = makeDataUrl(900, 0.65);
        resp = await fetch('http://localhost:3001/api/generate-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataURL,
            instructions: 'Create ONE new related practice problem in plain English only. No LaTeX/markdown/symbols/emojis. Use ASCII (19/5, sqrt(x)). Output only the problem statement. Make it self-contained and solvable.'
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
    // Fallback: heuristic based on the latest assistant message/topic
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
      const topic = extractTopic(lastAssistant);
      if (topic) {
        return `Create a new problem related to "${topic}". State the question clearly in plain English.`;
      }
    } catch (_) {}
    return 'Write a clear, self-contained practice problem closely related to the current topic shown on the whiteboard. Use plain English only.';
  };

  const handleAddPracticeQuestion = async () => {
    const question = await generatePracticeQuestionFromScene();
    addTextToCanvas(question);
    incrementProblemsSolvedToday();
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
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Back button overlay */}
      <div className="absolute top-4 left-4 z-50">
        <Button
          variant="outline"
          onClick={() => navigate('/app')}
          size="sm"
          className="bg-white shadow-md"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>
      </div>

      {/* Friends List Overlay */}
      {showFriends && (
        <div className="absolute top-16 left-4 z-50">
          <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 w-64">
            {/* Header */}
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-home-primary" />
                <div className="flex flex-col leading-tight">
                  <h3 className="text-sm font-semibold text-gray-900">Stuck on a problem?</h3>
                  <span className="text-xs text-gray-600">Ask a friend!</span>
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
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors group"
                      onClick={() => handleAskFriend(friend)}
                    >
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={friend.image_url || undefined} alt={getDisplayName(friend)} />
                        <AvatarFallback className="bg-home-primary text-white text-xs">
                          {getInitials(friend)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {getDisplayName(friend)}
                        </p>
                        <p className="text-xs text-gray-500">Ask for help</p>
                      </div>
                      <MessageSquare className="w-4 h-4 text-gray-400 group-hover:text-home-primary transition-colors" />
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-gray-500">
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
              <div className="p-2 border-t border-gray-200">
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
                  } else if (showChatInput) {
                    // If popup is open, close it
                    setShowChatInput(false);
                  } else {
                    // If there are existing messages, open sidebar directly
                    if (chatMessages.length > 0) {
                      setShowChatSidebar(true);
                    } else {
                      // Open popup for first question
                      setShowChatInput(true);
                    }
                  }
                }}
                className={`bg-white shadow-md ${(showChatInput || showChatSidebar) ? 'bg-blue-50 border-blue-300' : ''}`}
                title={showChatSidebar ? "Close chat" : "Open chat"}
              >
                <MessageSquare className="w-4 h-4" />
              </Button>
            </div>

            {/* Toggle Friends Button when hidden */}
            {!showFriends && (
              <div className="absolute top-16 left-4 z-50">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFriends(true)}
                  className="bg-white shadow-md"
                >
                  <Users className="w-4 h-4" />
                </Button>
              </div>
            )}

      {/* Movable Chat Input */}
      {showChatInput && (
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
            <div className="relative bg-gray-900 border border-gray-700 rounded-full px-4 py-3 flex items-center gap-3 shadow-lg min-w-80">
              {/* Draggable handle area - left side */}
              <div 
                className="absolute left-0 top-0 bottom-0 w-8 cursor-grab active:cursor-grabbing flex items-center justify-center"
                onMouseDown={handleMouseDown}
              >
                <Move className="w-4 h-4 text-gray-400" />
              </div>
              
              {/* Input field */}
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question about the whiteboard..."
                className="bg-transparent text-gray-200 placeholder-gray-400 flex-1 outline-none text-sm ml-8"
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
              <div className="flex items-center gap-1 text-gray-400 text-xs">
                <Command className="w-3 h-3" />
                <span>+ I</span>
              </div>
              
              {/* Send button */}
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 transition-colors"
                disabled={!chatInput.trim()}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Send className="w-4 h-4" />
              </button>
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
              className="bg-white/95 backdrop-blur-sm shadow-xl border border-gray-200 hover:bg-white"
            >
              <ChevronUp className="w-4 h-4 mr-2" />
              Select from {pdfPages.length} {pdfPages.length === 1 ? 'page' : 'pages'}
            </Button>
          ) : (
            // Expanded state - full scroller
            <div className="bg-white/95 backdrop-blur-sm rounded-lg shadow-xl p-3 border border-gray-200">
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
                    return (
                      <div
                        key={actualPageIndex}
                        className="relative group cursor-pointer hover:scale-105 transition-transform"
                        onClick={() => handlePageClick(actualPageIndex)}
                        title={`Click to add page ${actualPageIndex + 1} to canvas`}
                      >
                        <img
                          src={pageDataUrl}
                          alt={`Page ${actualPageIndex + 1}`}
                          className="h-24 w-auto rounded border-2 border-gray-300 shadow-sm hover:border-home-primary transition-colors"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs text-center py-1 rounded-b group-hover:bg-home-primary transition-colors">
                          Page {actualPageIndex + 1}
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
            className={`bg-white/95 backdrop-blur-sm rounded-full shadow-xl border border-gray-200 p-2 cursor-pointer ${!isTimerActive ? 'opacity-60' : ''}`}
            onClick={() => setIsTimerMinimized(false)}
            title={`${formatTime(totalStudyTime)} - ${isTimerActive ? 'Studying' : 'Paused'}`}
          >
            <Timer className={`w-4 h-4 ${isTimerActive ? 'text-green-600' : 'text-gray-400'}`} />
          </div>
        ) : (
          // Expanded state - full timer
          <div className={`bg-white/95 backdrop-blur-sm rounded-lg shadow-xl border border-gray-200 px-3 py-2 flex items-center gap-2 ${!isTimerActive ? 'opacity-60' : ''}`}>
            <Timer className={`w-4 h-4 ${isTimerActive ? 'text-green-600' : 'text-gray-400'}`} />
            <div className="flex flex-col cursor-pointer" onClick={() => setIsTimerMinimized(true)}>
              <span className="text-sm font-semibold text-gray-900">
                {formatTime(totalStudyTime)}
              </span>
              <span className="text-xs text-gray-500">
                {isTimerActive ? 'Studying' : 'Paused'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chat Sidebar (AI only) */}
      {showChatSidebar && (
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-white/95 backdrop-blur-sm shadow-xl border-l border-gray-200 z-[100] flex flex-col transition-all duration-300 overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-gray-700" />
                <h3 className="font-semibold text-gray-900">AI Chat</h3>
                {chatMessages.length > 0 && (
                  <span className="text-xs text-gray-500 ml-2">({chatMessages.length} messages)</span>
                )}
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowChatSidebar(false);
                }}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
            {chatMessages.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-400 opacity-50" />
                <p className="text-sm text-gray-500">Start a conversation</p>
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
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-900'
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
                            className="mt-2 w-full text-[10px] leading-tight py-1"
                          >
                            <Plus className="w-3 h-3 mr-1.5" />
                            Add Practice Question to Whiteboard
                          </Button>
                        </div>
                      ) : (
                        message.content.startsWith('data:image') ? (
                          <img src={message.content} alt="Workspace capture" className="rounded-md max-w-full h-auto" />
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        )
                      )}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2 flex items-center gap-2">
                      <Spinner size="sm" className="text-gray-600" />
                      <p className="text-sm">Thinking...</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          
          {/* Input Area */}
          <div className="p-4 border-t border-gray-200">
            <form onSubmit={handleChatSubmit} className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={chatMessages.length === 0 ? "Ask a question about the whiteboard..." : "Ask a follow-up question..."}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isChatLoading}
              />
              <Button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
            {chatMessages.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.confirm('Clear all chat messages?')) {
                    setChatMessages([]);
                    if (fileId) {
                      localStorage.removeItem(`chatMessages_${fileId}`);
                    }
                  }
                }}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Clear chat history
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Full page Excalidraw */}
      <div className="absolute inset-0" style={{ width: "100%", height: "100%" }}>
        <div className={theme === 'dark' ? 'excalidraw theme--dark' : 'excalidraw'}>
          <Excalidraw
            initialData={savedInitialData ?? initialData}
            onChange={handleExcalidrawChange}
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
          />
        </div>
      </div>

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
    </div>
  );
};

export default DocumentEditor;

