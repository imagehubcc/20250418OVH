import React, { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Terminal, Copy, Check, RotateCcw, Clock, Filter, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { LogEntry } from '@/types';

// 日志级别过滤
type LogLevel = 'all' | 'info' | 'warning' | 'error';

const ConsolePage: React.FC = () => {
  const { isConnected } = useWebSocket();
  const [logLevel, setLogLevel] = useState<LogLevel>('all');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleRef = useRef<HTMLDivElement>(null);
  
  // 使用 React Query 获取日志数据
  const { data: logsData } = useQuery<LogEntry[]>({
    queryKey: ['logs'],
    queryFn: () => apiService.getLogs(),
    staleTime: 5000,
  });

  // 确保 logs 是数组类型
  const logs = logsData || [];
  
  // 自动滚动到底部
  useEffect(() => {
    if (autoScroll && consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);
  
  // 过滤日志
  const filteredLogs = logs.filter((log) => {
    if (logLevel === 'all') return true;
    return log.level === logLevel;
  });
  
  // 复制日志到剪贴板
  const copyLogs = () => {
    const logText = filteredLogs.map(log => 
      `[${format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');
    
    navigator.clipboard.writeText(logText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  // 获取日志级别图标
  const getLevelIcon = (level: string) => {
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
  
  // 获取日志级别样式
  const getLevelClass = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-tech-blue';
      case 'warning':
        return 'text-tech-yellow';
      case 'error':
        return 'text-tech-red';
      default:
        return 'text-tech-blue';
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部标题区域 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">控制台</h1>
        <p className="text-muted-foreground">查看系统日志和操作记录</p>
      </div>
      
      {/* 控制台操作栏 */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-2">
          <Terminal className="h-5 w-5 text-tech-blue" />
          <span className="font-mono text-sm">
            {isConnected ? (
              <span className="text-tech-green">已连接到后端服务</span>
            ) : (
              <span className="text-tech-red">未连接到后端服务</span>
            )}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                {logLevel === 'all' ? '全部日志' : 
                 logLevel === 'info' ? '信息' : 
                 logLevel === 'warning' ? '警告' : '错误'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>日志级别</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem 
                checked={logLevel === 'all'}
                onCheckedChange={() => setLogLevel('all')}
              >
                全部日志
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={logLevel === 'info'}
                onCheckedChange={() => setLogLevel('info')}
              >
                <Info className="h-4 w-4 mr-2 text-tech-blue" />
                信息
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={logLevel === 'warning'}
                onCheckedChange={() => setLogLevel('warning')}
              >
                <AlertTriangle className="h-4 w-4 mr-2 text-tech-yellow" />
                警告
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem 
                checked={logLevel === 'error'}
                onCheckedChange={() => setLogLevel('error')}
              >
                <XCircle className="h-4 w-4 mr-2 text-tech-red" />
                错误
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setAutoScroll(!autoScroll)}
          >
            <Clock className={`h-4 w-4 mr-2 ${autoScroll ? 'text-tech-green' : 'text-muted-foreground'}`} />
            {autoScroll ? '自动滚动: 开' : '自动滚动: 关'}
          </Button>
          
          <Button variant="outline" size="sm" onClick={copyLogs}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2 text-tech-green" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                复制日志
              </>
            )}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              if (consoleRef.current) {
                consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
              }
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            滚动到底部
          </Button>
        </div>
      </div>
      
      {/* 日志控制台 */}
      <div className="tech-card h-[600px] overflow-hidden flex flex-col">
        <div className="border-b border-border p-2 flex justify-between items-center bg-muted/30">
          <div className="text-sm font-medium">系统日志</div>
          <div className="text-xs text-muted-foreground">
            共 {filteredLogs.length} 条日志
          </div>
        </div>
        <div 
          ref={consoleRef}
          className="tech-console flex-1 overflow-y-auto p-4 font-mono text-sm"
        >
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Terminal className="h-12 w-12 mb-2 opacity-50" />
              <p>没有日志记录</p>
            </div>
          ) : (
            filteredLogs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className="mb-1 leading-relaxed">
                <span className="text-muted-foreground">
                  [{format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}]
                </span>
                <span className={`ml-2 inline-flex items-center ${getLevelClass(log.level)}`}>
                  {getLevelIcon(log.level)}
                  <span className="ml-1 font-semibold">[{log.level.toUpperCase()}]</span>
                </span>
                <span className="ml-2">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsolePage;
