import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useWebSocket } from '@/hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';
import { zhLocale } from '@/lib/locale';
import { CheckCircle, XCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { OrderHistory } from '@/types';

const RecentOrders: React.FC = () => {
  const { isConnected } = useWebSocket();
  
  // 使用 React Query 获取订单数据
  const { data: orders = [] } = useQuery<OrderHistory[], Error>({
    queryKey: ['orders'],
    queryFn: () => apiService.getOrders(),
    staleTime: 10000,
  });
  
  // 获取最近5个订单
  const recentOrders = [...orders].sort((a, b) => {
    return new Date(b.orderTime).getTime() - new Date(a.orderTime).getTime();
  }).slice(0, 5);
  
  // 格式化时间
  const formatTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: zhLocale });
    } catch (e) {
      return '未知时间';
    }
  };

  return (
    <Card className="tech-card h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base font-medium">近期订单</CardTitle>
          <div className="tech-badge tech-badge-blue">
            <span>{orders.length} 个订单</span>
          </div>
        </div>
        <CardDescription>
          最近的抢购订单记录
        </CardDescription>
      </CardHeader>
      <CardContent>
        {recentOrders.length > 0 ? (
          <div className="space-y-4">
            {recentOrders.map((order) => (
              <div 
                key={order.id}
                className="flex items-start space-x-3 p-3 rounded-md border border-border hover:bg-muted/20 transition-colors duration-200"
              >
                <div className="mt-1">
                  {order.status === 'success' ? (
                    <CheckCircle className="h-5 w-5 text-tech-green" />
                  ) : (
                    <XCircle className="h-5 w-5 text-tech-red" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="text-sm font-medium truncate" title={order.name}>
                      {order.name}
                    </h4>
                    <span className={`tech-badge ${order.status === 'success' ? 'tech-badge-green' : 'tech-badge-red'}`}>
                      {order.status === 'success' ? '成功' : '失败'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {order.datacenter} | {order.planCode} | {formatTime(order.orderTime)}
                  </p>
                  
                  {order.status === 'success' && order.orderUrl && (
                    <div className="mt-2">
                      <a 
                        href={order.orderUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-tech-blue hover:text-tech-purple transition-colors"
                      >
                        查看订单 <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  )}
                  
                  {order.status === 'failed' && order.error && (
                    <p className="text-xs text-tech-red mt-1 truncate" title={order.error}>
                      {order.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
            
            <Link 
              to="/history"
              className="flex items-center justify-center p-2 mt-2 text-sm text-tech-blue hover:text-tech-purple transition-colors border-t border-border pt-4"
            >
              查看所有订单 <ArrowRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="mb-2">暂无订单记录</p>
            <p className="text-sm">成功的抢购订单将显示在这里</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentOrders;
