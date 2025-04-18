import React, { useState } from 'react';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from '@tanstack/react-query';
import { apiService } from '@/services/api';
import { ApiConfig } from '@/types';
import { useToast } from "@/components/ui/use-toast";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Check, MessageSquare, Trash2 } from 'lucide-react';
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

// 创建验证Schema
const telegramSchema = z.object({
  tgToken: z.string().min(1, "请输入Telegram机器人令牌"),
  tgChatId: z.string().min(1, "请输入Telegram聊天ID")
});

// 类型定义
type TelegramFormValues = z.infer<typeof telegramSchema>;

// 组件属性类型
interface TelegramFormProps {
  tgConfig?: {
    tgToken?: string;
    tgChatId?: string;
  };
}

const TelegramForm: React.FC<TelegramFormProps> = ({ tgConfig }) => {
  const { toast } = useToast();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 设置表单
  const form = useForm<TelegramFormValues>({
    resolver: zodResolver(telegramSchema),
    defaultValues: {
      // 敏感字段处理
      tgToken: tgConfig?.tgToken === "******" ? "" : tgConfig?.tgToken || "",
      tgChatId: tgConfig?.tgChatId === "******" ? "" : tgConfig?.tgChatId || "",
    }
  });

  // 保存配置
  const saveTelegramConfig = async (config: Partial<ApiConfig>): Promise<void> => {
    await apiService.setTelegramConfig(config);
    return;
  };

  // 保存配置mutation
  const saveConfigMutation = useMutation({
    mutationFn: saveTelegramConfig,
    onSuccess: () => {
      toast({
        title: "Telegram配置已保存",
        description: "通知设置已成功更新"
      });
    },
    onError: () => {
      toast({
        title: "错误",
        description: "保存Telegram配置时发生错误",
        variant: "destructive"
      });
    }
  });

  // 添加清除Telegram配置的mutation
  const clearTelegramConfigMutation = useMutation({
    mutationFn: apiService.clearTelegramConfig,
    onSuccess: () => {
      toast({
        title: "Telegram配置已清除",
        description: "Telegram通知配置已成功清除"
      });
      // 重置表单数据
      form.reset({
        tgToken: "",
        tgChatId: ""
      });
      // 刷新页面以获取最新配置
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "错误",
        description: "清除Telegram配置时发生错误",
        variant: "destructive"
      });
    }
  });

  // 处理清除配置
  const handleClearConfig = () => {
    clearTelegramConfigMutation.mutate();
    setShowClearConfirm(false);
  };

  // 提交表单
  const onSubmit = (values: TelegramFormValues) => {
    // 构建配置对象
    const telegramConfig: Partial<ApiConfig> = {
      tgToken: values.tgToken || "",
      tgChatId: values.tgChatId || ""
    };
    
    // 保留原始值如果用户未输入且配置中有值
    if (!values.tgToken && tgConfig?.tgToken) {
      telegramConfig.tgToken = tgConfig.tgToken;
    }
    if (!values.tgChatId && tgConfig?.tgChatId) {
      telegramConfig.tgChatId = tgConfig.tgChatId;
    }
    
    // 提交保存
    saveConfigMutation.mutate(telegramConfig);
  };

  // 判断是否已配置
  const isConfigured = !!(tgConfig && tgConfig.tgToken && tgConfig.tgChatId);
  
  return (
    <Card className="tech-card">
      <CardHeader>
        <CardTitle>Telegram通知配置</CardTitle>
        <CardDescription>
          设置Telegram机器人通知，实时接收抢购结果
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          {isConfigured ? (
            <div className="flex items-center p-3 rounded-md bg-tech-green/10 border border-tech-green/30 text-tech-green">
              <Check className="h-5 w-5 mr-2" />
              <span>Telegram通知已配置</span>
            </div>
          ) : (
            <div className="flex items-center p-3 rounded-md bg-tech-yellow/10 border border-tech-yellow/30 text-tech-yellow">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <span>未配置Telegram通知，成功抢购后将无法接收通知</span>
            </div>
          )}
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium flex items-center">
                <MessageSquare className="h-4 w-4 mr-2" />
                Telegram设置
              </h3>
              <p className="text-sm text-muted-foreground">
                配置Telegram机器人通知，可以实时接收抢购成功通知
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="tgToken"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="tech-label">Telegram Bot Token</FormLabel>
                    <FormControl>
                      <Input className="tech-input" placeholder="输入Bot Token" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      通过@BotFather创建机器人获取Token
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tgChatId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="tech-label">Telegram Chat ID</FormLabel>
                    <FormControl>
                      <Input className="tech-input" placeholder="输入Chat ID" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      要接收通知的聊天ID
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Separator />
            
            <div className="flex justify-between space-x-4 pt-2">
              <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
                <AlertDialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="text-tech-red border-tech-red/20 hover:bg-tech-red/10"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    清除Telegram配置
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清除Telegram配置?</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作将删除所有Telegram通知配置。删除后您将无法接收抢购成功的通知。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearConfig}
                      className="bg-tech-red hover:bg-tech-red/90"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      确认清除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              
              <Button
                type="submit"
                variant="default"
                disabled={saveConfigMutation.isPending}
                className="bg-tech-blue hover:bg-tech-blue/80"
              >
                {saveConfigMutation.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    保存中...
                  </>
                ) : (
                  "保存配置"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default TelegramForm; 