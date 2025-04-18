import React from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Clock, Database, Server, ShoppingCart, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import StatusCard from '@/components/dashboard/StatusCard';
import ActivityLog from '@/components/dashboard/ActivityLog';
import TasksOverview from '@/components/dashboard/TasksOverview';
import RecentOrders from '@/components/dashboard/RecentOrders';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { TaskStatus, OrderHistory } from '@/types';

const Dashboard: React.FC = () => {
  const { isConnected } = useWebSocket();

  // 使用React Query获取数据
  const { data: tasksData } = useQuery<TaskStatus[]>({
    queryKey: ['tasks'],
    queryFn: () => apiService.getTasks(),
    staleTime: 5000, // 5 seconds
  });

  const { data: ordersData } = useQuery<OrderHistory[]>({
    queryKey: ['orders'],
    queryFn: () => apiService.getOrders(),
    staleTime: 10000, // 10 seconds
  });

  // 使用默认空数组防止空值
  const tasks = tasksData || [];
  const orders = ordersData || [];
  
  // 计算统计数据
  const activeTasksCount = tasks.filter(task => task.status === 'running' || task.status === 'pending').length;
  const completedOrdersCount = orders.filter(order => order.status === 'success').length;
  const failedOrdersCount = orders.filter(order => order.status === 'failed').length;
  
  // 计算任务成功率
  const successRate = orders.length > 0 
    ? Math.round((completedOrdersCount / orders.length) * 100) 
    : 0;
  
  // 渲染连接状态
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
  
  return (
    <div className="space-y-6">
      {/* 顶部标题 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center">
          <h1 className="text-2xl font-bold tracking-tight">仪表盘</h1>
          {renderConnectionStatus()}
        </div>
      </div>
      
      {/* 数据展示卡片区 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard 
          title="活跃任务"
          value={activeTasksCount}
          description="正在运行和等待的任务"
          icon={<Clock className="h-5 w-5" />}
          variant="info"
        />
        <StatusCard 
          title="成功订单"
          value={completedOrdersCount}
          description="成功完成的抢购订单"
          icon={<ShoppingCart className="h-5 w-5" />}
          variant="success"
        />
        <StatusCard 
          title="失败订单"
          value={failedOrdersCount}
          description="失败的抢购尝试"
          icon={<AlertCircle className="h-5 w-5" />}
          variant="danger"
        />
        <StatusCard 
          title="成功率"
          value={`${successRate}%`}
          description="抢购成功率"
          icon={<Database className="h-5 w-5" />}
          variant={successRate > 50 ? "success" : successRate > 20 ? "warning" : "danger"}
        />
      </div>
      
      {/* 快速访问按钮 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/servers" className="tech-card group hover:shadow-tech-hover p-5 flex flex-col justify-center items-center transition-all duration-300">
          <Server className="h-8 w-8 mb-2 text-tech-blue group-hover:text-tech-purple transition-colors" />
          <div className="text-center">
            <h3 className="font-medium">浏览服务器</h3>
            <p className="text-sm text-muted-foreground">查看和检查服务器可用性</p>
          </div>
        </Link>
        <Link to="/queue" className="tech-card group hover:shadow-tech-hover p-5 flex flex-col justify-center items-center transition-all duration-300">
          <ShoppingCart className="h-8 w-8 mb-2 text-tech-blue group-hover:text-tech-purple transition-colors" />
          <div className="text-center">
            <h3 className="font-medium">管理抢购队列</h3>
            <p className="text-sm text-muted-foreground">创建和管理抢购任务</p>
          </div>
        </Link>
        <Link to="/settings" className="tech-card group hover:shadow-tech-hover p-5 flex flex-col justify-center items-center transition-all duration-300">
          <Database className="h-8 w-8 mb-2 text-tech-blue group-hover:text-tech-purple transition-colors" />
          <div className="text-center">
            <h3 className="font-medium">API配置</h3>
            <p className="text-sm text-muted-foreground">设置OVH API和通知功能</p>
          </div>
        </Link>
      </div>
      
      {/* 信息卡片区 */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TasksOverview />
          <RecentOrders />
        </div>
        <ActivityLog />
      </div>
    </div>
  );
};

export default Dashboard;
