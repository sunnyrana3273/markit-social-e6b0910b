import { useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StudyContributionsGraphProps {
  dailyMetrics: Array<{ date: string; minutes_studied: number }>;
  themeColor: string;
}

export const StudyContributionsGraph: React.FC<StudyContributionsGraphProps> = ({
  dailyMetrics,
  themeColor,
}) => {
  // Generate array of dates for the past month (aligned to weeks starting Sunday)
  const dates = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get the last 30 days
    const datesArray: Date[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      datesArray.push(date);
    }
    
    // Find the first Sunday before or on the first date
    const firstDate = datesArray[0];
    const firstDayOfWeek = firstDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Add days before to complete the first week (start from Sunday)
    const daysToAdd = firstDayOfWeek;
    for (let i = daysToAdd - 1; i >= 0; i--) {
      const date = new Date(firstDate);
      date.setDate(date.getDate() - (i + 1));
      datesArray.unshift(date);
    }
    
    return datesArray;
  }, []);

  // Create a map of date to minutes for quick lookup
  const metricsMap = useMemo(() => {
    const map = new Map<string, number>();
    dailyMetrics.forEach((metric) => {
      map.set(metric.date, metric.minutes_studied || 0);
    });
    return map;
  }, [dailyMetrics]);

  // Convert hex color to HSL for brightness manipulation
  const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100),
    };
  };

  // Get color for a day based on minutes studied
  const getDayColor = (minutes: number): string | null => {
    if (minutes === 0) {
      return null; // Return null for grey days (will use CSS class)
    }

    // Convert theme color to HSL
    const hsl = hexToHsl(themeColor);
    
    // Calculate brightness based on minutes (0-120 minutes range)
    // More minutes = brighter color
    const maxMinutes = 120; // Cap at 120 minutes for max brightness
    const normalizedMinutes = Math.min(minutes, maxMinutes) / maxMinutes;
    
    // Lightness ranges from 40% (low activity) to 80% (high activity)
    const lightness = 40 + (normalizedMinutes * 40);
    
    // Saturation ranges from 50% (low) to 100% (high)
    const saturation = 50 + (normalizedMinutes * 50);
    
    return `hsl(${hsl.h}, ${saturation}%, ${lightness}%)`;
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  // Get day name
  const getDayName = (date: Date): string => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  // Group dates by week for display (Calendar style - weeks as rows)
  const weeks = useMemo(() => {
    const weeksArray: Date[][] = [];
    
    // Group into weeks of 7 days
    for (let i = 0; i < dates.length; i += 7) {
      const week = dates.slice(i, i + 7);
      if (week.length > 0) {
        // Ensure week has 7 days (pad with future dates if needed)
        while (week.length < 7) {
          const lastDate = week[week.length - 1];
          const nextDate = new Date(lastDate);
          nextDate.setDate(nextDate.getDate() + 1);
          week.push(nextDate);
        }
        weeksArray.push(week);
      }
    }
    
    return weeksArray;
  }, [dates]);

  // Get intensity level text
  const getIntensityText = (minutes: number): string => {
    if (minutes === 0) return 'No activity';
    if (minutes < 15) return 'Light activity';
    if (minutes < 30) return 'Moderate activity';
    if (minutes < 60) return 'Active';
    if (minutes < 120) return 'Very active';
    return 'Extremely active';
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Past 30 days of study activity
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
            <span>Less</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-gray-200 dark:bg-gray-700" />
              {[10, 30, 60, 120].map((mins) => {
                const color = getDayColor(mins);
                return (
                  <div
                    key={mins}
                    className="w-3 h-3 rounded-sm"
                    style={color ? { backgroundColor: color } : undefined}
                  />
                );
              })}
            </div>
            <span>More</span>
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          {/* Day labels at the top */}
          <div className="flex gap-1 pl-8 mb-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="w-8 text-xs text-gray-500 dark:text-gray-500 text-center leading-none">
                {day}
              </div>
            ))}
          </div>
          
          {/* Weeks as rows */}
          <div className="flex flex-col gap-1">
            {weeks.map((week, weekIndex) => {
              // Check if this week contains the 1st of a month
              const hasFirstOfMonth = week.some(date => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date <= today && date.getDate() === 1;
              });
              const firstDate = week.find(date => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                return date <= today && date.getDate() === 1;
              });
              
              return (
                <div key={weekIndex} className="flex gap-1 items-center">
                  {/* Month label on the left */}
                  {hasFirstOfMonth && firstDate ? (
                    <div className="w-8 text-xs text-gray-500 dark:text-gray-500 leading-none text-right pr-2">
                      {firstDate.toLocaleDateString('en-US', { month: 'short' })}
                    </div>
                  ) : (
                    <div className="w-8" />
                  )}
                  
                  {/* Days in week (horizontal) */}
                  <div className="flex gap-1">
                    {week.map((date, dayIndex) => {
                      // Skip future dates
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      if (date > today) {
                        return (
                          <div 
                            key={`${weekIndex}-${dayIndex}`} 
                            className="w-8 h-8 rounded-sm"
                          />
                        );
                      }
                      
                      const dateStr = date.toISOString().split('T')[0];
                      const minutes = metricsMap.get(dateStr) || 0;
                      const color = getDayColor(minutes);
                      
                      return (
                        <Tooltip key={`${weekIndex}-${dayIndex}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={`w-8 h-8 rounded-sm cursor-pointer hover:ring-2 hover:ring-gray-400 dark:hover:ring-gray-600 transition-all ${
                                color === null ? 'bg-gray-200 dark:bg-gray-700' : ''
                              }`}
                              style={color ? { backgroundColor: color } : undefined}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-sm">
                              <div className="font-semibold">{formatDate(date)}</div>
                              <div className="text-gray-400">
                                {minutes > 0 ? `${minutes} minutes studied` : 'No activity'}
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {getIntensityText(minutes)}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};





