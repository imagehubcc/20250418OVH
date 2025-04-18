
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cva } from 'class-variance-authority';
import { ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';

interface StatusCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  change?: number;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  isLoading?: boolean;
}

const statusVariants = cva(
  "transition-all duration-300 shimmer",
  {
    variants: {
      variant: {
        default: "bg-card",
        success: "border-tech-green/30 bg-tech-green/5",
        warning: "border-tech-yellow/30 bg-tech-yellow/5",
        danger: "border-tech-red/30 bg-tech-red/5",
        info: "border-tech-blue/30 bg-tech-blue/5",
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

const StatusCard: React.FC<StatusCardProps> = ({
  title,
  value,
  description,
  icon,
  change,
  variant = 'default',
  isLoading = false
}) => {
  // 渲染变化趋势指示器
  const renderTrend = () => {
    if (change === undefined) return null;
    
    if (change > 0) {
      return (
        <div className="flex items-center text-tech-green text-sm">
          <ArrowUp className="h-4 w-4 mr-1" />
          <span>{change}%</span>
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center text-tech-red text-sm">
          <ArrowDown className="h-4 w-4 mr-1" />
          <span>{Math.abs(change)}%</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center text-muted-foreground text-sm">
          <ArrowRight className="h-4 w-4 mr-1" />
          <span>0%</span>
        </div>
      );
    }
  };

  return (
    <Card className={`tech-card ${statusVariants({ variant })}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          {icon && <div className="opacity-70">{icon}</div>}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col">
          {isLoading ? (
            <div className="h-8 w-24 bg-muted/50 rounded animate-pulse"></div>
          ) : (
            <div className="text-2xl font-bold">{value}</div>
          )}
          <div className="flex items-center justify-between mt-2">
            {description && (
              <CardDescription className="text-xs">
                {description}
              </CardDescription>
            )}
            {renderTrend()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default StatusCard;
