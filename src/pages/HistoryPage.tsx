import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { OrderHistory } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { zhLocale } from '@/lib/locale';
import { apiService } from '@/services/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import {
  FileText,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Search,
  Clock,
  Calendar,
  Trash2,
  FileSearch,
  Filter,
  List,
  Grid,
  RotateCw,
  Eye
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
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ToggleGroup,
  ToggleGroupItem
} from "@/components/ui/toggle-group";

type StatusFilter = 'all' | 'success' | 'error' | 'retrying';

type ViewMode = 'grid' | 'list';

const HistoryPage: React.FC = () => {
  const { isConnected } = useWebSocket();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  
  useEffect(() => {
    const webSocketManager = apiService.webSocketManager;
    
    const handleOrderUpdate = () => {
      console.log('收到订单更新通知，正在刷新订单列表...');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    };
    
    if (webSocketManager) {
      webSocketManager.on('orderCreated', handleOrderUpdate);
      webSocketManager.on('orderUpdated', handleOrderUpdate);
      webSocketManager.on('taskCompleted', handleOrderUpdate);
    }
    
    return () => {
      if (webSocketManager) {
        webSocketManager.off('orderCreated', handleOrderUpdate);
        webSocketManager.off('orderUpdated', handleOrderUpdate);
        webSocketManager.off('taskCompleted', handleOrderUpdate);
      }
    };
  }, [queryClient]);
  
  const { 
    data: orders = [], 
    isLoading: isOrdersLoading, 
    error: ordersError,
    refetch: refetchOrders
  } = useQuery<OrderHistory[], Error>({
    queryKey: ['orders'],
    queryFn: () => apiService.getOrders(),
    staleTime: 5 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 10 * 1000,
    retry: 3,
  });
  
  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: string) => apiService.deleteOrder(orderId),
    onSuccess: () => {
      toast({
        title: "订单已删除",
        description: "购买记录已成功从历史中移除",
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (error) => {
      console.error('删除订单失败:', error);
      toast({
        title: "删除订单失败",
        description: "无法删除购买记录，请稍后重试",
        variant: "destructive",
      });
    },
  });
  
  const clearOrdersMutation = useMutation({
    mutationFn: () => apiService.clearOrders(),
    onSuccess: () => {
      toast({
        title: "所有记录已清除",
        description: "所有购买记录已成功从历史中移除",
      });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      setShowClearConfirm(false);
    },
    onError: (error) => {
      console.error('清除订单失败:', error);
      toast({
        title: "清除记录失败",
        description: "无法清除购买记录，请稍后重试",
        variant: "destructive",
      });
    },
  });
  
  const handleRefreshOrders = () => {
    setIsRefreshing(true);
    toast({
      title: "正在刷新",
      description: "正在获取最新订单数据",
      duration: 2000,
    });
    refetchOrders().finally(() => {
      setTimeout(() => setIsRefreshing(false), 1000);
    });
  };
  
  const handleDeleteOrder = (orderId: string) => {
    setOrderToDelete(orderId);
  };
  
  const confirmDeleteOrder = () => {
    if (orderToDelete) {
      deleteOrderMutation.mutate(orderToDelete);
      setOrderToDelete(null);
    }
  };
  
  const cancelDeleteOrder = () => {
    setOrderToDelete(null);
  };
  
  const getStatusIcon = (status: string, error?: string) => {
    // 检查是否是服务器配置暂时不可用
    const isUnavailableError = error && (
      error.includes("不可用") || 
      error.includes("暂时不可用") || 
      error.includes("is not available in")
    );
    
    if (status === 'success') {
      return <CheckCircle className="h-5 w-5 text-tech-green" />;
    } else if (isUnavailableError) {
      return <Clock className="h-5 w-5 text-tech-yellow" />;
    } else {
      return <AlertTriangle className="h-5 w-5 text-tech-red" />;
    }
  };
  
  const getStatusLabel = (status: string, error?: string) => {
    // 检查是否是服务器配置暂时不可用
    const isUnavailableError = error && (
      error.includes("不可用") || 
      error.includes("暂时不可用") || 
      error.includes("is not available in")
    );
    
    if (status === 'success') {
      return '成功';
    } else if (isUnavailableError) {
      return '待重试';
    } else {
      return '失败';
    }
  };
  
  const getStatusClass = (status: string, error?: string) => {
    // 检查是否是服务器配置暂时不可用
    const isUnavailableError = error && (
      error.includes("不可用") || 
      error.includes("暂时不可用") || 
      error.includes("is not available in")
    );
    
    if (status === 'success') {
      return 'bg-tech-green/20 text-tech-green';
    } else if (isUnavailableError) {
      return 'bg-tech-yellow/20 text-tech-yellow';
    } else {
      return 'bg-tech-red/20 text-tech-red';
    }
  };
  
  const formatTime = (timestamp: string | undefined) => {
    if (!timestamp) return '未知时间';
    try {
      const date = new Date(timestamp);
      // 使用本地格式展示时间，更加直观
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (e) {
      return '未知时间';
    }
  };
  
  // 返回格式化的错误信息，优化显示效果
  const formatErrorMessage = (error?: string) => {
    if (!error) return '无详细信息';
    
    // 简化服务器不可用的错误信息
    if (error.includes("is not available in")) {
      const matches = error.match(/(.+) is not available in (.+)/);
      if (matches && matches.length > 2) {
        const config = matches[1];
        const datacenter = matches[2];
        return `配置 ${config} 在 ${datacenter} 数据中心暂不可用`;
      }
    }
    
    // 截断过长的错误信息以适应展示空间
    return error.length > 80 ? error.substring(0, 77) + '...' : error;
  };
  
  const filteredOrders = orders
    .filter((order) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'retrying') {
        // 检查是否是待重试的订单
        return order.status !== 'success' && order.error && (
          order.error.includes("不可用") || 
          order.error.includes("暂时不可用") || 
          order.error.includes("is not available in")
        );
      }
      return statusFilter === order.status;
    })
    .filter((order) => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        (order.name?.toLowerCase().includes(query) ?? false) ||
        (order.planCode?.toLowerCase().includes(query) ?? false) ||
        (order.datacenter?.toLowerCase().includes(query) ?? false) ||
        (order.orderId?.toLowerCase().includes(query) ?? false) ||
        (order.error?.toLowerCase().includes(query) ?? false)
      );
    });
  
  const orderStats = {
    all: orders.length,
    success: orders.filter(o => o.status === 'success').length,
    retrying: orders.filter(o => 
      o.status !== 'success' && o.error && (
        o.error.includes("不可用") || 
        o.error.includes("暂时不可用") || 
        o.error.includes("is not available in")
      )
    ).length,
    error: orders.filter(o => 
      o.status !== 'success' && (!o.error || !(
        o.error.includes("不可用") || 
        o.error.includes("暂时不可用") || 
        o.error.includes("is not available in")
      ))
    ).length,
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
          <TableHead>服务器</TableHead>
          <TableHead>数据中心</TableHead>
          <TableHead>订单号</TableHead>
          <TableHead>详情</TableHead>
          <TableHead>订单时间</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredOrders.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center py-8">
              <div className="flex flex-col items-center justify-center text-muted-foreground">
                <FileSearch className="h-10 w-10 mb-2 opacity-50" />
                <p>没有找到符合条件的订单记录</p>
              </div>
            </TableCell>
          </TableRow>
        ) : (
          filteredOrders.map((order) => (
            <TableRow key={order.id} className="group">
              <TableCell>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(order.status, order.error)}
                  <Badge variant="outline" className={getStatusClass(order.status, order.error)}>
                    {getStatusLabel(order.status, order.error)}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <div>
                  <p className="font-medium">{order.name}</p>
                  <p className="text-xs text-muted-foreground">{order.planCode}</p>
                </div>
              </TableCell>
              <TableCell>{order.datacenter}</TableCell>
              <TableCell>
                {order.orderId ? (
                  order.orderUrl ? (
                    <a 
                      href={order.orderUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-tech-blue hover:underline flex items-center"
                    >
                      {order.orderId}
                      <FileText className="h-3 w-3 ml-1" />
                    </a>
                  ) : (
                    order.orderId
                  )
                ) : '无订单号'}
              </TableCell>
              <TableCell className="max-w-[300px]">
                {order.error && (
                  <div className={`text-sm truncate ${getStatusClass(order.status, order.error)}`}>
                    {order.status === 'success' ? (
                      <CheckCircle className="h-3 w-3 inline mr-1" />
                    ) : getStatusLabel(order.status, order.error) === '待重试' ? (
                      <Clock className="h-3 w-3 inline mr-1" />
                    ) : (
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                    )}
                    {formatErrorMessage(order.error)}
                    <Button
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0 ml-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setSelectedError(order.error)}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm">
                  <div className="flex items-center text-muted-foreground">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatTime(order.orderTime)}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleDeleteOrder(order.id)}
                >
                  <span className="sr-only">删除</span>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  const renderGridView = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredOrders.length === 0 ? (
        <Card className="col-span-full tech-card p-6 flex flex-col items-center justify-center">
          <FileSearch className="h-12 w-12 text-tech-gray mb-4" />
          <h3 className="text-lg font-medium mb-2">没有找到符合条件的订单记录</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            当前筛选条件下没有订单，请尝试清除搜索或切换筛选条件
          </p>
          <Button variant="outline" onClick={() => setSearchQuery('')}>
            清除搜索
          </Button>
        </Card>
      ) : (
        filteredOrders.map((order) => (
          <Card 
            key={order.id} 
            className={`tech-card overflow-hidden group transition-all duration-200 
              ${order.status === 'success' ? 'border-tech-green/50 shadow-md hover:shadow-lg hover:border-tech-green/70' : ''}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className={getStatusClass(order.status, order.error)}>
                  <div className="flex items-center space-x-1">
                    {getStatusIcon(order.status, order.error)}
                    <span>{getStatusLabel(order.status, order.error)}</span>
                  </div>
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => handleDeleteOrder(order.id)}
                >
                  <span className="sr-only">删除</span>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardTitle className="mt-2 text-base font-medium">{order.name}</CardTitle>
              <CardDescription className="flex justify-between">
                <span>服务器: {order.planCode}</span>
                <span>数据中心: {order.datacenter}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-3">
              {order.orderId && (
                <p className="text-sm mb-2">
                  订单号: {order.orderUrl ? (
                    <a 
                      href={order.orderUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-tech-blue hover:underline flex items-center inline-flex"
                    >
                      {order.orderId}
                      <FileText className="h-3 w-3 ml-1" />
                    </a>
                  ) : (
                    <span className="font-mono">{order.orderId}</span>
                  )}
                </p>
              )}
              {order.error && (
                <p className={`text-sm mb-2 truncate ${getStatusClass(order.status, order.error)}`} title={order.error}>
                  {order.status === 'success' ? (
                    <CheckCircle className="h-3 w-3 inline mr-1" />
                  ) : getStatusLabel(order.status, order.error) === '待重试' ? (
                    <Clock className="h-3 w-3 inline mr-1" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                  )}
                  {formatErrorMessage(order.error)}
                  <Button
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 ml-1 text-muted-foreground hover:text-foreground"
                    onClick={() => setSelectedError(order.error)}
                  >
                    <Eye className="h-3 w-3" />
                  </Button>
                </p>
              )}
              <div className="text-sm">
                <div className="flex items-center text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4 mr-1" />
                  {formatTime(order.orderTime)}
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
  
  const renderLoading = () => {
    if (isOrdersLoading && !orders.length) {
      return (
        <div className="text-center p-8">
          <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin text-tech-blue" />
          <p className="text-muted-foreground">正在加载订单数据...</p>
        </div>
      );
    }
    return null;
  };
  
  const renderError = () => {
    if (ordersError) {
      return (
        <div className="bg-red-50 border border-red-200 text-red-600 p-4 rounded-md mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            <span>加载订单数据失败: {ordersError.message}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 border-red-300"
            onClick={() => refetchOrders()}
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
      <div className="space-y-4">
        {/* 操作栏 */}
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-foreground flex items-center">
              <FileText className="mr-2 h-5 w-5 text-tech-blue" />
              购买历史
            </h2>
            {renderConnectionStatus()}
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshOrders}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? '刷新中...' : '刷新'}
            </Button>
            {orders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center text-tech-red"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                清除全部
              </Button>
            )}
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className={statusFilter === 'all' ? 'bg-tech-blue hover:bg-tech-blue/80' : ''}
            >
              全部 ({orderStats.all})
            </Button>
            <Button
              variant={statusFilter === 'success' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('success')}
              className={statusFilter === 'success' ? 'bg-tech-green hover:bg-tech-green/80' : ''}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              成功 ({orderStats.success})
            </Button>
            <Button
              variant={statusFilter === 'retrying' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('retrying')}
              className={statusFilter === 'retrying' ? 'bg-tech-yellow hover:bg-tech-yellow/80' : ''}
            >
              <Clock className="mr-1 h-4 w-4" />
              待重试 ({orderStats.retrying})
            </Button>
            <Button
              variant={statusFilter === 'error' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('error')}
              className={statusFilter === 'error' ? 'bg-tech-red hover:bg-tech-red/80' : ''}
            >
              <AlertTriangle className="mr-1 h-4 w-4" />
              失败 ({orderStats.error})
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="搜索记录..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
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
        
        {!isOrdersLoading && !ordersError && (
          <div>
            {viewMode === 'grid' ? renderGridView() : renderListView()}
          </div>
        )}
        
        <AlertDialog open={!!orderToDelete} onOpenChange={(open) => !open && cancelDeleteOrder()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>确认删除此记录?</AlertDialogTitle>
              <AlertDialogDescription>
                删除后记录将从购买历史中移除，且无法恢复。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteOrder}
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
              <AlertDialogTitle>确认清除所有记录?</AlertDialogTitle>
              <AlertDialogDescription>
                此操作将删除所有购买历史记录，包括成功和失败的记录。此操作无法撤销。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => clearOrdersMutation.mutate()}
                className="bg-tech-red hover:bg-tech-red/90"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                清除全部
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        {/* 错误详情对话框 */}
        <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>错误详情</DialogTitle>
              <DialogDescription>完整的错误信息</DialogDescription>
            </DialogHeader>
            <div className="bg-muted p-4 rounded-md overflow-auto max-h-[300px] font-mono text-sm whitespace-pre-wrap">
              {selectedError}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedError(null)}>关闭</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default HistoryPage;
