import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { zhLocale } from '@/lib/locale';
import { useWebSocket } from '@/hooks/useWebSocket';
import { TaskStatus } from '@/types';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  PlayCircle,
  ArrowRight
} from 'lucide-react';

const TasksOverview: React.FC = () => {
  const { isConnected } = useWebSocket();
  
  // 使用 React Query 获取任务数据
  const { data: tasks = [] } = useQuery<TaskStatus[], Error>({
    queryKey: ['tasks'],
    queryFn: () => apiService.getTasks(),
    staleTime: 5000,
  });
  
  const sortedTasks = [...tasks].sort((a, b) => {
    const getStatusPriority = (status: string) => {
      switch (status) {
        case 'running': return 0;
        case 'pending': return 1;
        case 'error': return 2;
        case 'completed': return 3;
        default: return 4;
      }
    };
    return getStatusPriority(a.status) - getStatusPriority(b.status);
  }).slice(0, 5);

  const getStatusIcon = (status: string, message?: string) => {
    // 特殊情况：消息中包含"服务器配置暂时不可用"，显示为等待状态图标
    if (message && message.includes("服务器配置暂时不可用")) {
      return <Clock className="h-5 w-5 text-tech-yellow" />;
    }
    
    switch (status) {
      case 'running':
        return <PlayCircle className="h-5 w-5 text-tech-blue animate-pulse" />;
      case 'pending':
        return <Clock className="h-5 w-5 text-tech-yellow" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-tech-green" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-tech-red" />;
      default:
        return <AlertTriangle className="h-5 w-5 text-tech-gray" />;
    }
  };

  const getStatusLabel = (status: string, message?: string) => {
    // 特殊情况：消息中包含"服务器配置暂时不可用"，显示为"重试中"
    if (message && message.includes("服务器配置暂时不可用")) {
      return '重试中';
    }
    
    switch (status) {
      case 'running':
        return '运行中';
      case 'pending':
        return '等待中';
      case 'completed':
        return '已完成';
      case 'error':
        return '错误';
      default:
        return '未知';
    }
  };

  const getStatusClass = (status: string, message?: string) => {
    // 特殊情况：消息中包含"服务器配置暂时不可用"，使用黄色等待样式
    if (message && message.includes("服务器配置暂时不可用")) {
      return 'tech-badge-yellow';
    }
    
    switch (status) {
      case 'running':
        return 'tech-badge-blue';
      case 'pending':
        return 'tech-badge-yellow';
      case 'completed':
        return 'tech-badge-green';
      case 'error':
        return 'tech-badge-red';
      default:
        return '';
    }
  };

  const getTaskTimeInfo = (task: TaskStatus) => {
    if (task.status === 'pending' && task.nextRetryAt) {
      try {
        const nextRetryDate = new Date(task.nextRetryAt);
        return `下次重试: ${formatDistanceToNow(nextRetryDate, { addSuffix: true, locale: zhLocale })}`;
      } catch (e) {
        return '计划重试';
      }
    } else if (task.lastChecked) {
      try {
        const lastCheckedDate = new Date(task.lastChecked);
        return `最后检查: ${formatDistanceToNow(lastCheckedDate, { addSuffix: true, locale: zhLocale })}`;
      } catch (e) {
        return '最近检查';
      }
    } else if (task.createdAt) {
      try {
        const createdDate = new Date(task.createdAt);
        return `创建: ${formatDistanceToNow(createdDate, { addSuffix: true, locale: zhLocale })}`;
      } catch (e) {
        return '最近创建';
      }
    }
    return '';
  };

  return (
    <Card className="tech-card h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium">抢购任务概览</CardTitle>
          <div className="tech-badge tech-badge-blue">
            <span>{tasks.length} 个任务</span>
          </div>
        </div>
        <CardDescription>
          当前抢购任务的状态和进度
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sortedTasks.length > 0 ? (
          <div className="space-y-4">
            {sortedTasks.map((task) => (
              <div 
                key={task.id}
                className="flex items-center space-x-3 p-3 rounded-md border border-border hover:bg-muted/20 transition-colors duration-200"
              >
                <div>{getStatusIcon(task.status, task.message)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium truncate" title={task.name}>
                      {task.name}
                    </h4>
                    <div className={`tech-badge ${getStatusClass(task.status, task.message)}`}>
                      {getStatusLabel(task.status, task.message)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-xs text-muted-foreground">
                      {task.datacenter} | {task.planCode} 
                      {task.maxRetries > 0 ? ` | 重试 ${task.retryCount}/${task.maxRetries}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getTaskTimeInfo(task)}
                    </p>
                  </div>
                  {task.message && (
                    <p className="text-xs text-muted-foreground mt-1 truncate" title={task.message}>
                      {task.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            <Link 
              to="/queue"
              className="flex items-center justify-center p-2 mt-2 text-sm text-tech-blue hover:text-tech-purple transition-colors border-t border-border pt-4"
            >
              查看所有任务 <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="mb-2">暂无抢购任务</p>
            <p className="text-sm">前往服务器列表添加抢购任务</p>
            <Link
              to="/servers"
              className="mt-4 tech-button inline-flex"
            >
              浏览服务器
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TasksOverview;
