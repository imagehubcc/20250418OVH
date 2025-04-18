import { useEffect, useState, useCallback, useRef } from 'react';
import { webSocketManager, apiService } from '@/services/api';
import { TaskStatus, OrderHistory, LogEntry } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

export function useWebSocket(useFallbackApi: boolean = true) {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [useFallback, setUseFallback] = useState(false);
  
  // 自动重连相关
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fallbackTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 处理连接打开
  const handleOpen = useCallback(() => {
    console.log('WebSocket连接已建立');
    setIsConnected(true);
    setConnectionStatus('connected');
    reconnectCountRef.current = 0;
    setUseFallback(false);
    
    // 清除fallback计时器
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    
    // 连接成功时显示通知
    if (reconnectCountRef.current > 0) {
      toast({
        title: "连接已恢复",
        description: "WebSocket连接已重新建立",
        duration: 3000,
      });
    }
    
    // 连接建立时，使所有相关数据查询失效，触发数据刷新
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['logs'] });
    queryClient.invalidateQueries({ queryKey: ['apiConfig'] });
  }, [queryClient]);

  // 处理连接关闭
  const handleClose = useCallback((data: any) => {
    console.log('WebSocket连接已关闭', data);
    setIsConnected(false);
    setConnectionStatus('disconnected');
    
    // 如果启用了fallback，设置计时器在5秒后切换到API模式
    if (useFallbackApi && !fallbackTimerRef.current) {
      fallbackTimerRef.current = setTimeout(() => {
        setUseFallback(true);
        fallbackTimerRef.current = null;
        console.log('已切换到API回退模式');
        toast({
          title: "已切换到API模式",
          description: "正在使用直接API请求获取数据，部分实时功能将不可用",
          variant: "default",
          duration: 5000,
        });
      }, 5000);
    }
    
    // 显示断开连接通知
    toast({
      title: "连接已断开",
      description: "正在尝试重新连接...",
      variant: "destructive",
      duration: 5000,
    });
  }, [useFallbackApi]);

  // 处理错误
  const handleError = useCallback((error: any) => {
    console.error('WebSocket连接错误:', error);
    setIsConnected(false);
    setConnectionStatus('error');
  }, []);

  // 处理初始数据 - 使查询失效，不直接更新状态
  const handleInitialData = useCallback((data: any) => {
    console.log('接收到初始数据', {
      tasks: data.tasks?.length || 0,
      orders: data.orders?.length || 0,
      logs: data.logs?.length || 0
    });
    
    // 触发相关数据的重新获取
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['logs'] });
    queryClient.invalidateQueries({ queryKey: ['apiConfig'] });
  }, [queryClient]);

  // 处理任务创建 - 使tasks查询失效
  const handleTaskCreated = useCallback((task: TaskStatus) => {
    console.log('收到任务创建事件:', task.id, task.name);
    
    // 使任务数据查询失效，触发重新获取
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    
    // 显示任务创建通知
    toast({
      title: "新任务已创建",
      description: `任务 "${task.name}" 已添加到队列`,
      duration: 3000,
    });
  }, [queryClient]);

  // 处理任务更新 - 使tasks查询失效
  const handleTaskUpdated = useCallback((task: TaskStatus) => {
    console.log('收到任务更新事件:', task.id, task.status);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  // 处理任务删除 - 使tasks查询失效
  const handleTaskDeleted = useCallback((data: { id: string }) => {
    console.log('收到任务删除事件:', data.id);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  }, [queryClient]);

  // 处理所有任务清除 - 使tasks查询失效
  const handleTasksCleared = useCallback((data: { count: number }) => {
    console.log(`收到任务清除事件: ${data.count} 个任务被清除`);
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    
    // 显示任务清除通知
    toast({
      title: "所有任务已清除",
      description: `已成功清除 ${data.count} 个任务`,
      duration: 3000,
    });
  }, [queryClient]);

  // 处理订单完成 - 使orders查询失效
  const handleOrderCompleted = useCallback((order: OrderHistory) => {
    console.log('收到订单完成事件:', order.id);
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  // 处理订单失败 - 使orders查询失效
  const handleOrderFailed = useCallback((order: OrderHistory) => {
    console.log('收到订单失败事件:', order.id);
    queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);

  // 处理日志 - 使logs查询失效
  const handleLog = useCallback((log: LogEntry) => {
    console.log('收到日志事件:', log.level, log.message.substring(0, 50));
    queryClient.invalidateQueries({ queryKey: ['logs'] });
  }, [queryClient]);

  // 处理pong响应
  const handlePong = useCallback((data: any) => {
    console.log('收到pong响应:', data);
  }, []);

  // 处理连接状态更新
  const handleConnectionStatus = useCallback((data: any) => {
    console.log('收到连接状态更新:', data.status);
    setConnectionStatus(data.status);
    setIsConnected(data.status === 'connected');
    
    // 如果连接恢复，则刷新所有数据
    if (data.status === 'connected') {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['apiConfig'] });
    }
  }, [queryClient]);

  // API轮询机制（当WebSocket不可用时）
  useEffect(() => {
    if (!useFallbackApi || !useFallback) return;
    
    console.log('启动API轮询备份机制');
    
    // 定期轮询任务数据
    const tasksPollInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }, 10000); // 每10秒轮询一次
    
    // 定期轮询订单数据
    const ordersPollInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }, 15000); // 每15秒轮询一次
    
    // 定期轮询日志数据
    const logsPollInterval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    }, 20000); // 每20秒轮询一次
    
    return () => {
      clearInterval(tasksPollInterval);
      clearInterval(ordersPollInterval);
      clearInterval(logsPollInterval);
    };
  }, [useFallbackApi, useFallback, queryClient]);

  // 建立连接
  useEffect(() => {
    console.log('初始化WebSocket连接...');
    
    // 注册所有事件处理器
    webSocketManager.on('open', handleOpen);
    webSocketManager.on('close', handleClose);
    webSocketManager.on('error', handleError);
    webSocketManager.on('initial_data', handleInitialData);
    webSocketManager.on('task_created', handleTaskCreated);
    webSocketManager.on('task_updated', handleTaskUpdated);
    webSocketManager.on('task_deleted', handleTaskDeleted);
    webSocketManager.on('tasks_cleared', handleTasksCleared);
    webSocketManager.on('order_completed', handleOrderCompleted);
    webSocketManager.on('order_failed', handleOrderFailed);
    webSocketManager.on('log', handleLog);
    webSocketManager.on('pong', handlePong);
    webSocketManager.on('connection_status', handleConnectionStatus);

    // 建立连接
    webSocketManager.connect();
    
    // 获取当前连接状态
    setIsConnected(webSocketManager.isConnected());
    setConnectionStatus(webSocketManager.getConnectionStatus());
    
    // 定期检查连接状态
    const checkInterval = setInterval(() => {
      const status = webSocketManager.getConnectionStatus();
      const connected = webSocketManager.isConnected();
      
      // 只在状态变化时更新
      if (status !== connectionStatus) {
        setConnectionStatus(status);
      }
      
      if (connected !== isConnected) {
        setIsConnected(connected);
      }
      
      // 如果连接断开且没有重连计时器，启动重连
      if (status === 'disconnected' && !reconnectTimerRef.current) {
        console.log('检测到连接已断开，准备重连...');
        reconnectCountRef.current += 1;
        
        // 使用指数退避策略
        const delay = Math.min(30000, 2000 * Math.pow(1.5, Math.min(reconnectCountRef.current, 10)));
        
        reconnectTimerRef.current = setTimeout(() => {
          console.log(`尝试第 ${reconnectCountRef.current} 次重连...`);
          webSocketManager.forceReconnect();
          reconnectTimerRef.current = null;
        }, delay);
      }
    }, 5000);
    
    // 每5分钟自动发送ping，保持连接活跃
    const pingInterval = setInterval(() => {
      if (webSocketManager.isConnected()) {
        webSocketManager.send({ type: 'ping' });
      }
    }, 5 * 60 * 1000);

    return () => {
      // 清理事件监听器
      webSocketManager.off('open', handleOpen);
      webSocketManager.off('close', handleClose);
      webSocketManager.off('error', handleError);
      webSocketManager.off('initial_data', handleInitialData);
      webSocketManager.off('task_created', handleTaskCreated);
      webSocketManager.off('task_updated', handleTaskUpdated);
      webSocketManager.off('task_deleted', handleTaskDeleted);
      webSocketManager.off('tasks_cleared', handleTasksCleared);
      webSocketManager.off('order_completed', handleOrderCompleted);
      webSocketManager.off('order_failed', handleOrderFailed);
      webSocketManager.off('log', handleLog);
      webSocketManager.off('pong', handlePong);
      webSocketManager.off('connection_status', handleConnectionStatus);
      
      // 清理定时器
      clearInterval(checkInterval);
      clearInterval(pingInterval);
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [
    handleOpen, handleClose, handleError, handleInitialData,
    handleTaskCreated, handleTaskUpdated, handleTaskDeleted,
    handleTasksCleared, handleOrderCompleted, handleOrderFailed, 
    handleLog, handlePong, handleConnectionStatus,
    isConnected, connectionStatus, queryClient
  ]);

  // 手动触发重连
  const reconnect = useCallback(() => {
    console.log('手动触发重连...');
    toast({
      title: "正在重新连接",
      description: "正在尝试重新建立WebSocket连接",
      duration: 3000,
    });
    
    // 清除fallback状态和计时器
    setUseFallback(false);
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    
    webSocketManager.forceReconnect();
  }, []);

  return {
    isConnected,
    connectionStatus,
    usingFallbackApi: useFallback,
    reconnect
  };
}
