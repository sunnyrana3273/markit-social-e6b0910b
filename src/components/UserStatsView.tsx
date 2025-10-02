import { Clock, Brain, Flame, Heart } from 'lucide-react';
import { useUserStats } from '@/hooks/useUserStats';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState } from 'react';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  isEmpty: boolean;
  emptyMessage: string;
}

const StatCard = ({ icon, label, value, isEmpty, emptyMessage }: StatCardProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = typeof value === 'number' ? value : 0;

  // Determine animation intensity based on value
  const getScaleClass = () => {
    if (isEmpty || numericValue === 0) return 'hover:scale-102';
    if (numericValue <= 10) return 'hover:scale-102';
    if (numericValue <= 100) return 'hover:scale-105';
    if (numericValue <= 1000) return 'hover:scale-108';
    return 'hover:scale-110';
  };

  const getGlowClass = () => {
    if (numericValue >= 1000) return 'hover:shadow-glow-primary';
    return '';
  };

  const getGradientIntensity = () => {
    if (isEmpty || numericValue === 0) return 'opacity-50';
    if (numericValue <= 10) return 'opacity-60';
    if (numericValue <= 100) return 'opacity-75';
    if (numericValue <= 1000) return 'opacity-90';
    return 'opacity-100';
  };

  // Counting animation
  useEffect(() => {
    if (typeof value === 'number') {
      let start = 0;
      const end = value;
      const duration = 1000;
      const increment = end / (duration / 16);

      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setDisplayValue(end);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(start));
        }
      }, 16);

      return () => clearInterval(timer);
    }
  }, [value]);

  return (
    <div
      className={`
        glass p-6 rounded-lg transition-all duration-300 
        ${getScaleClass()} ${getGlowClass()}
        border border-border/50
        ${isEmpty ? 'grayscale' : ''}
      `}
    >
      <div className="flex items-center gap-4">
        <div className={`
          p-4 rounded-full 
          bg-gradient-to-br from-primary/20 to-secondary/20
          ${getGradientIntensity()}
          transition-all duration-300
        `}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-3xl font-bold text-foreground mt-1">
            {isEmpty ? emptyMessage : (typeof value === 'number' ? displayValue : value)}
          </p>
        </div>
      </div>

      {/* Progress bar for milestones */}
      {!isEmpty && typeof value === 'number' && value > 0 && (
        <div className="mt-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000"
              style={{ 
                width: `${Math.min((value % 100) / 100 * 100, 100)}%` 
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {value >= 100 ? `${Math.floor(value / 100)} milestone${Math.floor(value / 100) > 1 ? 's' : ''} reached!` : `${100 - (value % 100)} to next milestone`}
          </p>
        </div>
      )}
    </div>
  );
};

export const UserStatsView = () => {
  const { stats, isLoading } = useUserStats();

  if (isLoading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const isEmpty = !stats || (
    stats.lifetime_minutes_studied === 0 &&
    stats.lifetime_questions_answered === 0 &&
    stats.longest_streak === 0 &&
    !stats.favorite_community_name
  );

  return (
    <div className="space-y-6 p-4">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-foreground">Your Statistics</h2>
        <p className="text-muted-foreground">Track your learning journey</p>
      </div>

      <div className="grid gap-4">
        <StatCard
          icon={<Clock className="w-6 h-6 text-primary" />}
          label="Lifetime Minutes Studied"
          value={stats?.lifetime_minutes_studied || 0}
          isEmpty={!stats?.lifetime_minutes_studied}
          emptyMessage="Start studying!"
        />

        <StatCard
          icon={<Brain className="w-6 h-6 text-secondary" />}
          label="Questions Answered"
          value={stats?.lifetime_questions_answered || 0}
          isEmpty={!stats?.lifetime_questions_answered}
          emptyMessage="Ask your first question!"
        />

        <StatCard
          icon={<Flame className="w-6 h-6 text-accent" />}
          label="Longest Streak"
          value={stats?.longest_streak || 0}
          isEmpty={!stats?.longest_streak}
          emptyMessage="Build your streak!"
        />

        <StatCard
          icon={<Heart className="w-6 h-6 text-destructive" />}
          label="Favorite Community"
          value={stats?.favorite_community_name || "None yet"}
          isEmpty={!stats?.favorite_community_name}
          emptyMessage="Join a community!"
        />
      </div>

      {isEmpty && (
        <div className="mt-8 p-6 glass rounded-lg text-center">
          <p className="text-muted-foreground">
            Start your learning journey today! Study, ask questions, and join communities to see your stats grow.
          </p>
        </div>
      )}
    </div>
  );
};
