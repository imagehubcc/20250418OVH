import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { zhLocale } from '@/lib/locale';
import { AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { LogEntry } from '@/types';

const MAX_LOGS = 8; // 最大显示日志条数

const ActivityLog: React.FC = () => {
  const { isConnected } = useWebSocket();
  const logContainerRef = useRef<HTMLDivElement>(null);

  // 使用 React Query 获取日志数据
  const { data: logsData } = useQuery<LogEntry[]>({
    queryKey: ['logs'],
    queryFn: () => apiService.getLogs(),
    staleTime: 5000,
  });

  // 确保 logs 是数组类型
  const logs = logsData || [];

  // 获取最新的日志，限制数量
  const recentLogs = logs.slice(-MAX_LOGS);

  // 自动滚动到底部
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // 根据日志级别获取图标和样式
  const getLogIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <Info className="h-4 w-4 text-tech-blue" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-tech-yellow" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-tech-red" />;
      default:
        return <Info className="h-4 w-4 text-tech-blue" />;
    }
  };

  // 格式化时间
  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true, locale: zhLocale });
    } catch (e) {
      return '未知时间';
    }
  };

  return (
    <Card className="tech-card h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium">活动日志</CardTitle>
          <div className="tech-badge tech-badge-blue">
            <span>实时动态</span>
          </div>
        </div>
        <CardDescription>
          系统最新活动记录
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div 
          ref={logContainerRef}
          className="overflow-y-auto"
          style={{ maxHeight: '180px' }}
        >
          {recentLogs.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <div className="mb-2">暂无活动日志</div>
              <div className="text-sm">系统活动将实时显示在此处</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentLogs.map((log, index) => (
                <div 
                  key={`${log.timestamp}-${index}`}
                  className="flex items-start space-x-2 animate-fade-in-up border border-border/30 rounded-md p-2"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="mt-1 flex-shrink-0">{getLogIcon(log.level)}</div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-sm leading-tight truncate" title={log.message}>{log.message}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(log.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityLog;
