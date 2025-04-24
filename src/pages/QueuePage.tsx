import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWebSocket } from '@/hooks/useWebSocket';
import { TaskStatus } from '@/types';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { zhLocale } from '@/lib/locale';
import {
  Plus,
  PlayCircle,
  StopCircle,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  FileSearch,
  Filter,
  List,
  Grid,
  Trash,
  RotateCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type StatusFilter = 'all' | 'running' | 'pending' | 'completed' | 'error';

type ViewMode = 'grid' | 'list';

const QueuePage: React.FC = () => {
  const { isConnected } = useWebSocket();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const { 
    data: tasks = [], 
    isLoading: isTasksLoading, 
    error: tasksError,
    refetch: refetchTasks
  } = useQuery<TaskStatus[], Error>({
    queryKey: ['tasks'],
    queryFn: () => apiService.getTasks(),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: 3,
  });
  
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => apiService.deleteTask(taskId),
    onSuccess: () => {
      toast({
        title: "任务已删除",
        description: "抢购任务已成功从队列中移除",
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('删除任务失败:', error);
      toast({
        title: "删除任务失败",
        description: "无法删除抢购任务，请稍后重试",
        variant: "destructive",
      });
    },
  });
  
  const clearTasksMutation = useMutation({
    mutationFn: () => apiService.clearTasks(),
    onSuccess: () => {
      toast({
        title: "所有任务已清除",
        description: "所有抢购任务已成功从队列中移除",
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowClearConfirm(false);
    },
    onError: (error) => {
      console.error('清除任务失败:', error);
      toast({
        title: "清除任务失败",
        description: "无法清除抢购任务，请稍后重试",
        variant: "destructive",
      });
    },
  });
  
  const retryTaskMutation = useMutation({
    mutationFn: (taskId: string) => {
      return apiService.retryTask(taskId);
    },
    onSuccess: () => {
      toast({
        title: "任务已重置",
        description: "任务已重置为等待状态，将重新尝试",
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (error) => {
      console.error('重试任务失败:', error);
      toast({
        title: "重试任务失败",
        description: "无法重置任务状态，请稍后重试",
        variant: "destructive",
      });
    },
  });
  
  const retryOrderMutation = useMutation({
    mutationFn: (taskId: string) => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('任务不存在');
      }
      
      return apiService.createTask({
        name: task.name,
        planCode: task.planCode,
        datacenter: task.datacenter,
        options: [],
        duration: 'P1M',
        quantity: 1,
        os: 'none',
        maxRetries: task.maxRetries,
        taskInterval: 60
      });
    },
    onSuccess: () => {
      toast({
        title: "已创建新订单",
        description: "已重新创建相同配置的抢购任务",
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('重试订单失败:', error);
      toast({
        title: "重试订单失败",
        description: "无法创建新的抢购任务，请稍后重试",
        variant: "destructive",
      });
    },
  });
  
  const handleRefreshTasks = () => {
    toast({
      title: "正在刷新",
      description: "正在获取最新任务数据",
      duration: 2000,
    });
    refetchTasks();
  };
  
  const handleDeleteTask = (taskId: string) => {
    setTaskToDelete(taskId);
  };
  
  const confirmDeleteTask = () => {
    if (taskToDelete) {
      deleteTaskMutation.mutate(taskToDelete);
      setTaskToDelete(null);
    }
  };
  
  const cancelDeleteTask = () => {
    setTaskToDelete(null);
  };
  
  const handleRetryTask = (taskId: string) => {
    retryTaskMutation.mutate(taskId);
  };
  
  const handleRetryOrder = (taskId: string) => {
    retryOrderMutation.mutate(taskId);
  };
  
  const getStatusIcon = (status: string, message?: string) => {
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
        return <AlertTriangle className="h-5 w-5 text-tech-red" />;
      case 'max_retries_reached':
        return <StopCircle className="h-5 w-5 text-tech-red" />;
      default:
        return <FileSearch className="h-5 w-5 text-tech-gray" />;
    }
  };
  
  const getStatusLabel = (status: string, message?: string) => {
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
      case 'max_retries_reached':
        return '达到重试上限';
      default:
        return '未知';
    }
  };
  
  const getStatusClass = (status: string, message?: string) => {
    if (message && message.includes("服务器配置暂时不可用")) {
      return 'bg-tech-yellow/20 text-tech-yellow';
    }
    
    switch (status) {
      case 'running':
        return 'bg-tech-blue/20 text-tech-blue';
      case 'pending':
        return 'bg-tech-yellow/20 text-tech-yellow';
      case 'completed':
        return 'bg-tech-green/20 text-tech-green';
      case 'error':
      case 'max_retries_reached':
        return 'bg-tech-red/20 text-tech-red';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };
  
  const getRetryProgress = (task: TaskStatus) => {
    if (task.maxRetries <= 0) return 0;
    return (task.retryCount / task.maxRetries) * 100;
  };
  
  const formatTime = (timestamp: string | undefined) => {
    if (!timestamp) return '未知时间';
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: zhLocale });
    } catch (e) {
      return '未知时间';
    }
  };
  
  const filteredTasks = tasks.filter((task) => {
    if (statusFilter === 'all') return true;
    
    // 特殊情况：将"服务器配置暂时不可用"的任务归类为等待中(pending)
    if (task.message && task.message.includes("服务器配置暂时不可用")) {
      return statusFilter === 'pending';
    }
    
    return task.status === statusFilter;
  });
  
  const taskStats = {
    all: tasks.length,
    running: tasks.filter(t => t.status === 'running').length,
    pending: tasks.filter(t => t.status === 'pending' || (t.message && t.message.includes("服务器配置暂时不可用"))).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    error: tasks.filter(t => t.status === 'error' && !(t.message && t.message.includes("服务器配置暂时不可用"))).length,
  };
  
  const renderConnectionStatus = () => {
    if (isConnected) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-600 ml-2">
          <span className="h-2 w-2 rounded-full bg-green-600 mr-1 animate-pulse" />
          已连接
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-600 ml-2">
          <span className="h-2 w-2 rounded-full bg-red-600 mr-1" />
          未连接
        </Badge>
      );
    }
  };
  
  const renderListView = () => (
    <Table className="tech-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[120px]">状态</TableHead>
          <TableHead>任务名称</TableHead>
          <TableHead>服务器</TableHead>
          <TableHead>数据中心</TableHead>
          <TableHead>重试</TableHead>
          <TableHead>最后检查</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredTasks.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <FileSearch className="h-10 w-10 mb-2 opacity-50" />
                <p>没有找到匹配的任务</p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          filteredTasks.map((task) => (
            <TableRow key={task.id} className="group">
              <TableCell>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(task.status, task.message)}
                  <Badge variant="outline" className={getStatusClass(task.status, task.message)}>
                    {getStatusLabel(task.status, task.message)}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="font-medium">{task.name}</TableCell>
              <TableCell>{task.planCode}</TableCell>
              <TableCell>{task.datacenter}</TableCell>
              <TableCell>
                <div className="w-full space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span>{task.retryCount}{task.maxRetries > 0 ? `/${task.maxRetries}` : ' (无限)'}</span>
                    {task.status === 'pending' && (
                      <span className="text-muted-foreground">下次: {formatTime(task.nextRetryAt)}</span>
                    )}
                  </div>
                  <Progress 
                    value={getRetryProgress(task)} 
                    className={`h-1.5 w-full ${task.maxRetries <= 0 ? 'bg-tech-blue/10' : ''}`} 
                  />
                </div>
              </TableCell>
              <TableCell>{formatTime(task.lastChecked)}</TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <span className="sr-only">打开菜单</span>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>任务操作</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {task.status === 'error' && (
                      <DropdownMenuItem onClick={() => handleRetryTask(task.id)}>
                        <RotateCw className="mr-2 h-4 w-4" />
                        <span>重试任务</span>
                      </DropdownMenuItem>
                    )}
                    {task.status === 'completed' && (
                      <DropdownMenuItem onClick={() => handleRetryOrder(task.id)}>
                        <RotateCw className="mr-2 h-4 w-4" />
                        <span>重试订单</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleDeleteTask(task.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>删除任务</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
  
  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {filteredTasks.length === 0 ? (
        <Card className="col-span-full tech-card p-6 flex flex-col items-center justify-center">
          <FileSearch className="h-12 w-12 text-tech-gray mb-4" />
          <h3 className="text-lg font-medium mb-2">没有找到匹配的任务</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            当前筛选条件下没有任务，请尝试其他筛选条件或添加新任务
          </p>
          <Link to="/queue/new">
            <Button variant="default" className="bg-tech-blue hover:bg-tech-blue/80">
              <Plus className="mr-2 h-4 w-4" />
              添加新任务
            </Button>
          </Link>
        </Card>
      ) : (
        filteredTasks.map((task) => (
          <Card key={task.id} className="tech-card overflow-hidden group">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={getStatusClass(task.status, task.message)}>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(task.status, task.message)}
                    <span>{getStatusLabel(task.status, task.message)}</span>
                  </div>
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <span className="sr-only">打开菜单</span>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>任务操作</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {task.status === 'error' && (
                      <DropdownMenuItem onClick={() => handleRetryTask(task.id)}>
                        <RotateCw className="mr-2 h-4 w-4" />
                        <span>重试任务</span>
                      </DropdownMenuItem>
                    )}
                    {task.status === 'completed' && (
                      <DropdownMenuItem onClick={() => handleRetryOrder(task.id)}>
                        <RotateCw className="mr-2 h-4 w-4" />
                        <span>重试订单</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleDeleteTask(task.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>删除任务</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardTitle className="mt-2 text-base font-medium">{task.name}</CardTitle>
              <CardDescription className="flex justify-between">
                <span>服务器: {task.planCode}</span>
                <span>数据中心: {task.datacenter}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              {task.message && (
                <p className="text-sm mb-2 truncate" title={task.message}>
                  {task.message}
                </p>
              )}
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span>创建时间: {formatTime(task.createdAt)}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span>最后检查: {formatTime(task.lastChecked)}</span>
                </div>
                {task.status === 'pending' && task.nextRetryAt && (
                  <div className="flex justify-between items-center text-sm">
                    <span>下次重试: {formatTime(task.nextRetryAt)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-sm">
                  <span>重试次数: {task.retryCount}{task.maxRetries > 0 ? `/${task.maxRetries}` : ' (无限)'}</span>
                </div>
                <Progress 
                  value={getRetryProgress(task)} 
                  className={`h-1.5 w-full ${task.maxRetries <= 0 ? 'bg-tech-blue/10' : ''}`} 
                />
              </div>
            </CardContent>
            <CardFooter className="pt-3 border-t border-border flex justify-end">
              {task.status === 'error' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-tech-blue hover:text-tech-blue/80 hover:bg-tech-blue/10 mr-2"
                  onClick={() => handleRetryTask(task.id)}
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  重试任务
                </Button>
              )}
              {task.status === 'completed' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-tech-blue hover:text-tech-blue/80 hover:bg-tech-blue/10 mr-2"
                  onClick={() => handleRetryOrder(task.id)}
                >
                  <RotateCw className="mr-2 h-4 w-4" />
                  重试订单
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-tech-red hover:text-tech-red/80 hover:bg-tech-red/10"
                onClick={() => handleDeleteTask(task.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                删除任务
              </Button>
            </CardFooter>
          </Card>
        ))
      )}
    </div>
  );
  
  const renderLoading = () => {
    if (isTasksLoading && !tasks.length) {
      return (
        <div className="text-center p-8">
          <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-tech-blue" />
          <p className="text-muted-foreground">正在加载任务数据...</p>
        </div>
      );
    }
    return null;
  };
  
  const renderError = () => {
    if (tasksError) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-md mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>加载任务数据失败: {tasksError.message}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 border-red-300"
            onClick={() => refetchTasks()}
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            重试
          </Button>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold">抢购队列</h1>
          {renderConnectionStatus()}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshTasks}
            className="flex items-center"
            disabled={isTasksLoading}
          >
            {isTasksLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                加载中...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-1" />
                刷新
              </>
            )}
          </Button>
          {tasks.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center text-tech-red"
            >
              <Trash className="h-4 w-4 mr-1" />
              清除所有
            </Button>
          )}
          <Link to="/queue/new">
            <Button className="bg-tech-blue hover:bg-tech-blue/80">
              <Plus className="h-4 w-4 mr-1" />
              添加任务
            </Button>
          </Link>
        </div>
      </div>
      
      {renderError()}
      
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className={statusFilter === 'all' ? 'bg-tech-blue hover:bg-tech-blue/80' : ''}
          >
            全部 ({taskStats.all})
          </Button>
          <Button
            variant={statusFilter === 'running' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('running')}
            className={statusFilter === 'running' ? 'bg-tech-blue hover:bg-tech-blue/80' : ''}
          >
            <PlayCircle className="mr-1 h-4 w-4" />
            运行中 ({taskStats.running})
          </Button>
          <Button
            variant={statusFilter === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('pending')}
            className={statusFilter === 'pending' ? 'bg-tech-yellow hover:bg-tech-yellow/80' : ''}
          >
            <Clock className="mr-1 h-4 w-4" />
            等待中 ({taskStats.pending})
          </Button>
          <Button
            variant={statusFilter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('completed')}
            className={statusFilter === 'completed' ? 'bg-tech-green hover:bg-tech-green/80' : ''}
          >
            <CheckCircle className="mr-1 h-4 w-4" />
            已完成 ({taskStats.completed})
          </Button>
          <Button
            variant={statusFilter === 'error' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('error')}
            className={statusFilter === 'error' ? 'bg-tech-red hover:bg-tech-red/80' : ''}
          >
            <AlertTriangle className="mr-1 h-4 w-4" />
            错误 ({taskStats.error})
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">视图:</span>
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className={viewMode === 'grid' ? 'bg-tech-blue hover:bg-tech-blue/80' : ''}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
            className={viewMode === 'list' ? 'bg-tech-blue hover:bg-tech-blue/80' : ''}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {renderLoading()}
      
      {!isTasksLoading && !tasksError && (
        <div className="mt-4">
          {viewMode === 'grid' ? renderGridView() : renderListView()}
        </div>
      )}
      
      <AlertDialog open={!!taskToDelete} onOpenChange={(open) => !open && cancelDeleteTask()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除任务?</AlertDialogTitle>
            <AlertDialogDescription>
              删除后任务将停止执行，且无法恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteTask}
              className="bg-tech-red hover:bg-tech-red/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认清除所有任务?</AlertDialogTitle>
            <AlertDialogDescription>
              此操作将删除队列中的所有任务，包括已完成、等待和错误状态的任务。此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearTasksMutation.mutate()}
              className="bg-tech-red hover:bg-tech-red/90"
            >
              <Trash className="mr-2 h-4 w-4" />
              清除所有
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default QueuePage;
