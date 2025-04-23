import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { DATACENTERS, AddonOption, ServerConfig } from '@/types';

import {
  Form,
  FormControl,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";

// 表单验证模式
const taskFormSchema = z.object({
  name: z.string().min(1, "请输入任务名称"),
  planCode: z.string().min(1, "请输入目标服务器型号"),
  datacenter: z.string().min(1, "请选择数据中心"),
  quantity: z.number().int().min(1).max(5),
  os: z.string().default("none_64.en"),
  duration: z.string().default("P1M"),
  options: z.array(z.any()).optional(),
  maxRetries: z.number().int().min(-1).max(100),
  taskInterval: z.number().int().min(5).max(600),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

const AddTaskForm: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [selectedOptions, setSelectedOptions] = useState<AddonOption[]>([]);
  
  // 获取URL参数
  const urlPlanCode = searchParams.get('planCode');
  const urlDatacenter = searchParams.get('datacenter');
  const urlOptions = searchParams.get('options');
  
  // 获取所有服务器列表
  const { data: serverCatalog, isLoading: isCatalogLoading } = useQuery({
    queryKey: ['serverCatalog'],
    queryFn: () => apiService.getServers(),
  });
  
  // 获取特定服务器的可用性信息
  const { data: serverAvailability, isLoading: isAvailabilityLoading } = useQuery({
    queryKey: ['serverAvailability', urlPlanCode],
    queryFn: () => urlPlanCode ? apiService.getServerAvailability(urlPlanCode) : null,
    enabled: !!urlPlanCode,
  });
  
  // 创建抢购任务的mutation
  const createTaskMutation = useMutation({
    mutationFn: (values: TaskFormValues) => {
      // 1. 从 react-hook-form 的 values 中获取 options
      const formOptions: AddonOption[] = values.options || [];

      // 2. 将前端的 AddonOption[] ({ family, option }) 转换为后端期望的 ServerOption[] ({ label, value })
      const backendOptions = formOptions.map(opt => ({
        label: opt.family, // 使用 family 作为 label
        value: opt.option  // 使用 option 作为 value
      }));

      // 3. 构建只包含后端 ServerConfig 所需字段的精确载荷
      const payload = { // 移除显式的 ServerConfig 类型标注
        name: values.name,
        planCode: values.planCode,
        datacenter: values.datacenter,
        options: backendOptions, // 使用转换后的 options
        // 添加前端 ServerConfig 类型需要的其他字段（使用默认值）
        duration: values.duration || "P1M", // 使用表单值或默认值
        quantity: values.quantity || 1,       // 使用表单值或默认值
        os: values.os || "none_64.en",   // 使用表单值或默认值
        maxRetries: values.maxRetries !== undefined ? values.maxRetries : -1, // 处理 0 的情况
        taskInterval: values.taskInterval || 60 // 使用表单值或默认值
      };

      // 4. 调用 API Service 发送精确载荷, 使用类型断言绕过签名检查
      return apiService.createTask(payload as any);
    },
    onSuccess: () => {
      toast({
        title: "任务已创建",
        description: "抢购任务已成功添加到队列",
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      navigate('/queue');
    },
    onError: (error) => {
      console.error('创建任务失败:', error);
      toast({
        title: "创建任务失败",
        description: "无法创建抢购任务，请稍后重试",
        variant: "destructive",
      });
    },
  });
  
  // 初始化表单
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      name: "",
      planCode: urlPlanCode || "",
      datacenter: urlDatacenter || "",
      quantity: 1,
      os: "none_64.en",
      duration: "P1M",
      options: [],
      maxRetries: -1,  // -1表示无限重试
      taskInterval: 60, // 60秒间隔
    },
  });
  
  // 用于查找服务器详细信息的辅助函数
  const findServerDetails = (planCode: string) => {
    if (!serverCatalog?.plans) return null;
    return serverCatalog.plans.find(plan => plan.planCode === planCode);
  };
  
  // 当服务器选择变化时更新可选选项
  const selectedServer = findServerDetails(form.watch('planCode'));
  
  // 当URL参数变化时更新表单，包括预选选项
  useEffect(() => {
    if (urlPlanCode) {
      form.setValue('planCode', urlPlanCode);
    }
    if (urlDatacenter) {
      form.setValue('datacenter', urlDatacenter);
    }
    
    // 处理从URL传递的选项参数
    if (urlOptions) {
      try {
        const parsedOptions = JSON.parse(decodeURIComponent(urlOptions)) as AddonOption[];
        if (Array.isArray(parsedOptions)) {
          setSelectedOptions(parsedOptions);
        }
      } catch (error) {
        console.error('解析选项参数失败:', error);
      }
    }
  }, [urlPlanCode, urlDatacenter, urlOptions, form]);
  
  // 表单提交处理
  const onSubmit = (values: TaskFormValues) => {
    createTaskMutation.mutate(values);
  };
  
  // 检查某个选项是否已被选中
  const isOptionSelected = (family: string, optionCode: string): boolean => {
    return selectedOptions.some(opt => opt.family === family && opt.option === optionCode);
  };
  
  // 选择或取消选择选项
  const toggleOption = (family: string, optionCode: string, checked: boolean) => {
    let newOptions: AddonOption[]; // 声明 newOptions 变量

    if (checked) {
      // 如果是互斥选项，需要先移除同一family的其他选项
      const isExclusive = selectedServer?.addonFamilies?.find(f => f.name === family)?.exclusive;
      let currentOptions = [...selectedOptions];
      
      if (isExclusive) {
        currentOptions = currentOptions.filter(opt => opt.family !== family);
      }
      
      newOptions = [ // 赋值给 newOptions
        ...currentOptions,
        { family, option: optionCode }
      ];
      setSelectedOptions(newOptions);
      // 同步更新 react-hook-form 的状态
      form.setValue('options', newOptions, { shouldValidate: true, shouldDirty: true }); // 添加选项以触发验证和脏状态

    } else {
      newOptions = selectedOptions.filter(opt => !(opt.family === family && opt.option === optionCode)); // 赋值给 newOptions
      setSelectedOptions(newOptions);
      // 同步更新 react-hook-form 的状态
      form.setValue('options', newOptions, { shouldValidate: true, shouldDirty: true }); // 添加选项以触发验证和脏状态
    }
  };
  
  return (
    <div className="max-w-2xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="tech-label">任务名称</FormLabel>
                  <FormControl>
                    <Input className="tech-input" placeholder="输入任务名称" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="planCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="tech-label">目标服务器型号</FormLabel>
                  <FormControl>
                    <Input 
                      className="tech-input" 
                      placeholder="输入目标服务器型号，例如：kimsufi-ks-1" 
                      disabled={!!urlPlanCode}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="datacenter"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="tech-label">数据中心</FormLabel>
                  <Select
                    disabled={!!urlDatacenter}
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="tech-input">
                        <SelectValue placeholder="选择数据中心" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DATACENTERS.map((dc) => (
                        <SelectItem key={dc.code} value={dc.code}>
                          {dc.name} ({dc.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="tech-label">购买数量</FormLabel>
                  <FormControl>
                    <Input 
                      className="tech-input" 
                      type="number" 
                      min={1} 
                      max={5} 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="maxRetries"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="tech-label">最大重试次数 ({field.value === -1 ? "无限" : field.value})</FormLabel>
                  <FormControl>
                    <Slider
                      defaultValue={[field.value]}
                      min={-1}
                      max={100}
                      step={1}
                      onValueChange={(value) => field.onChange(value[0])}
                      className="py-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="taskInterval"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="tech-label">重试间隔 ({field.value} 秒)</FormLabel>
                  <FormControl>
                    <Slider
                      defaultValue={[field.value]}
                      min={5}
                      max={600}
                      step={5}
                      onValueChange={(value) => field.onChange(value[0])}
                      className="py-2"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="flex justify-end space-x-4 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/queue')}
            >
              取消
            </Button>
            <Button
              type="submit"
              variant="default"
              disabled={createTaskMutation.isPending}
              className="bg-tech-blue hover:bg-tech-blue/80"
            >
              {createTaskMutation.isPending ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  创建中...
                </>
              ) : (
                "创建任务"
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default AddTaskForm;
