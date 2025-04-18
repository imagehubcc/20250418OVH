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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Check, Key, Trash2 } from 'lucide-react';
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

// 创建OVH API配置验证规则
const apiSchema = z.object({
  appKey: z.string().min(1, "请输入应用密钥"),
  appSecret: z.string().min(1, "请输入应用密钥"),
  consumerKey: z.string().min(1, "请输入消费者密钥"),
  endpoint: z.string(),
  zone: z.string(),
  iam: z.string().optional()
});

// 类型定义
type ApiFormValues = z.infer<typeof apiSchema>;

// 组件属性类型定义
interface ApiFormProps {
  apiConfig?: ApiConfig;
  zoneList?: string[];
}

const ApiForm: React.FC<ApiFormProps> = ({ apiConfig, zoneList }) => {
  const { toast } = useToast();
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // 使用useForm，设置验证规则
  const form = useForm<ApiFormValues>({
    resolver: zodResolver(apiSchema),
    defaultValues: {
      // 对敏感字段，如果从API返回的是脱敏值（******），则在表单中显示为空字符串
      appKey: apiConfig?.appKey === "******" ? "" : apiConfig?.appKey || "",
      appSecret: apiConfig?.appSecret === "******" ? "" : apiConfig?.appSecret || "",
      consumerKey: apiConfig?.consumerKey === "******" ? "" : apiConfig?.consumerKey || "",
      // 非敏感字段正常使用
      endpoint: apiConfig?.endpoint || "ovh-eu",
      zone: apiConfig?.zone || "IE",
      iam: apiConfig?.iam || ""
    }
  });

  // 保存OVH API配置
  const saveApiConfig = async (config: Partial<ApiConfig>): Promise<void> => {
    await apiService.setOvhApiConfig(config);
    return;
  };

  // 保存配置mutation
  const saveConfigMutation = useMutation({
    mutationFn: saveApiConfig,
    onSuccess: () => {
      toast({
        title: "API配置已保存",
        description: "OVH API配置已成功更新"
      });
    },
    onError: () => {
      toast({
        title: "错误",
        description: "保存API配置时发生错误",
        variant: "destructive"
      });
    }
  });

  // 添加清除OVH API配置的mutation
  const clearApiConfigMutation = useMutation({
    mutationFn: apiService.clearOvhApiConfig,
    onSuccess: () => {
      toast({
        title: "API配置已清除",
        description: "OVH API配置已成功清除"
      });
      // 重置表单数据
      form.reset({
        appKey: "",
        appSecret: "",
        consumerKey: "",
        endpoint: "ovh-eu",
        zone: "IE",
        iam: ""
      });
      // 刷新页面以获取最新配置
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "错误",
        description: "清除API配置时发生错误",
        variant: "destructive"
      });
    }
  });

  // 处理清除配置
  const handleClearConfig = () => {
    clearApiConfigMutation.mutate();
    setShowClearConfirm(false);
  };

  // 提交表单
  const onSubmit = (values: ApiFormValues) => {
    // 构建OVH API配置对象
    const ovhConfig: Partial<ApiConfig> = {
      appKey: values.appKey || "",
      appSecret: values.appSecret || "",
      consumerKey: values.consumerKey || "",
      endpoint: values.endpoint,
      zone: values.zone,
      iam: values.iam || ""
    };
    
    // 如果有敏感字段显示为****** 且用户未修改，则保留原值
    if (!values.appKey && apiConfig?.appKey) {
      ovhConfig.appKey = apiConfig.appKey;
    }
    if (!values.appSecret && apiConfig?.appSecret) {
      ovhConfig.appSecret = apiConfig.appSecret;
    }
    if (!values.consumerKey && apiConfig?.consumerKey) {
      ovhConfig.consumerKey = apiConfig.consumerKey;
    }
    
    // 提交保存
    saveConfigMutation.mutate(ovhConfig);
  };
  
  // 获取表单状态
  const isConfigured = !!(apiConfig && apiConfig.appKey && apiConfig.appSecret && apiConfig.consumerKey);
  
  return (
    <Card className="tech-card">
      <CardHeader>
        <CardTitle>OVH API配置</CardTitle>
        <CardDescription>
          配置OVH API凭据以启用抢购功能
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          {isConfigured ? (
            <div className="flex items-center p-3 rounded-md bg-tech-green/10 border border-tech-green/30 text-tech-green">
              <Check className="h-5 w-5 mr-2" />
              <span>API配置已设置</span>
            </div>
          ) : (
            <div className="flex items-center p-3 rounded-md bg-tech-yellow/10 border border-tech-yellow/30 text-tech-yellow">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <span>请配置API凭据以启用抢购功能</span>
            </div>
          )}
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-6">
            <div className="space-y-2">
              <h3 className="text-lg font-medium flex items-center">
                <Key className="h-4 w-4 mr-2" />
                OVH API凭据
              </h3>
              <p className="text-sm text-muted-foreground">
                在<a href="https://api.ovh.com/createApp/" target="_blank" rel="noopener noreferrer" className="text-tech-blue hover:underline">OVH API</a>创建应用获取密钥
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="appKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="tech-label">应用密钥 (Application Key)</FormLabel>
                    <FormControl>
                      <Input className="tech-input" placeholder="输入应用密钥" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="appSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="tech-label">应用密钥 (Application Secret)</FormLabel>
                    <FormControl>
                      <Input className="tech-input" type="password" placeholder="输入应用密钥" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="consumerKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="tech-label">消费者密钥 (Consumer Key)</FormLabel>
                    <FormControl>
                      <Input className="tech-input" placeholder="输入消费者密钥" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="endpoint"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="tech-label">API端点</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="tech-input">
                          <SelectValue placeholder="选择API端点" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ovh-eu">ovh-eu (欧洲)</SelectItem>
                        <SelectItem value="ovh-us">ovh-us (美国)</SelectItem>
                        <SelectItem value="ovh-ca">ovh-ca (加拿大)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="zone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="tech-label">地区</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="tech-input">
                          <SelectValue placeholder="选择地区" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="IE">爱尔兰 (IE)</SelectItem>
                        <SelectItem value="FR">法国 (FR)</SelectItem>
                        <SelectItem value="DE">德国 (DE)</SelectItem>
                        <SelectItem value="GB">英国 (GB)</SelectItem>
                        <SelectItem value="IT">意大利 (IT)</SelectItem>
                        <SelectItem value="ES">西班牙 (ES)</SelectItem>
                        <SelectItem value="PL">波兰 (PL)</SelectItem>
                        <SelectItem value="NL">荷兰 (NL)</SelectItem>
                        <SelectItem value="PT">葡萄牙 (PT)</SelectItem>
                        <SelectItem value="FI">芬兰 (FI)</SelectItem>
                        <SelectItem value="LT">立陶宛 (LT)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="iam"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="tech-label">标识符 (IAM)</FormLabel>
                    <FormControl>
                      <Input className="tech-input" placeholder="go-ovh-ie" {...field} />
                    </FormControl>
                    <FormDescription className="text-xs">
                      用于区分不同的抢购实例，默认为go-ovh-{form.watch('zone').toLowerCase()}
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
                    清除API凭据
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认清除API配置?</AlertDialogTitle>
                    <AlertDialogDescription>
                      此操作将删除所有OVH API凭据信息。删除后您需要重新配置才能继续使用抢购功能。
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

export default ApiForm;
