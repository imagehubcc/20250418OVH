import React, { useEffect, useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import ApiForm from '@/components/settings/ApiForm';
import TelegramForm from '@/components/settings/TelegramForm';
import { Settings, Trash2 } from 'lucide-react';
import { apiService } from '@/services/api';
import { ApiConfig } from '@/types';
import { toast } from '@/hooks/use-toast';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
} from "@/components/ui/alert-dialog";

const SettingsPage: React.FC = () => {
  const [apiConfig, setApiConfig] = useState<ApiConfig | undefined>(undefined);
  const [showClearOrdersConfirm, setShowClearOrdersConfirm] = useState(false);
  
  // 获取API配置
  const { data: config, isLoading } = useQuery({
    queryKey: ['apiConfig'],
    queryFn: apiService.getApiConfig,
    refetchOnWindowFocus: false,
    retry: 1
  });
  
  // 清除所有订单记录
  const clearOrdersMutation = useMutation({
    mutationFn: apiService.clearOrders,
    onSuccess: () => {
      toast({
        title: "所有记录已清除",
        description: "所有购买历史记录已成功删除"
      });
      setShowClearOrdersConfirm(false);
    },
    onError: (error) => {
      toast({
        title: "清除失败",
        description: "清除购买历史记录时发生错误",
        variant: "destructive"
      });
    }
  });

  // 处理清除所有记录
  const handleClearOrders = () => {
    clearOrdersMutation.mutate();
  };
  
  // 当配置数据加载完成后更新状态
  useEffect(() => {
    if (config) {
      setApiConfig(config);
    }
  }, [config]);
  
  return (
    <div className="space-y-8">
      {/* 顶部标题区域 */}
      <div className="flex items-start gap-2">
        <Settings className="h-8 w-8 text-tech-blue mt-1" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">设置</h1>
          <p className="text-muted-foreground">配置OVH Titan Sniper系统参数</p>
        </div>
      </div>
      
      {/* API配置表单 */}
      <div className="space-y-8">
        <ApiForm apiConfig={apiConfig} />
        
        {/* Telegram配置表单 */}
        <TelegramForm tgConfig={apiConfig} />
        
        {/* 记录清理区域 */}
        <Card className="tech-card">
          <CardHeader>
            <CardTitle>记录清理</CardTitle>
            <CardDescription>
              清除系统中的各类记录数据
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-medium">所有购买记录</h3>
                  <p className="text-sm text-muted-foreground">
                    清除系统中保存的所有购买历史记录
                  </p>
                </div>
                <AlertDialog open={showClearOrdersConfirm} onOpenChange={setShowClearOrdersConfirm}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="text-tech-red border-tech-red/20 hover:bg-tech-red/10"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      清除全部记录
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认清除所有购买记录?</AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作将删除所有购买历史记录，包括成功和失败的记录。此操作无法撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearOrders}
                        className="bg-tech-red hover:bg-tech-red/90"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        清除全部
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* 版本信息 */}
      <div className="text-center mt-12 text-sm text-muted-foreground">
        <p>OVH Titan Sniper v1.0</p>
        <p className="mt-1">© 2025 保留所有权利</p>
      </div>
    </div>
  );
};

export default SettingsPage;
