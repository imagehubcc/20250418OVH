import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { 
  AlertCircle, 
  CheckCircle, 
  Cpu, 
  Database, 
  HardDrive, 
  Info, 
  MemoryStick, 
  Monitor, 
  Radio, 
  Server, 
  Plus, 
  Clock,
  XCircle,
  Settings,
  Check,
  RefreshCw,
  Bug,
  X
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhLocale } from '@/lib/locale';
import { FormattedServer, DatacenterAvailability, DATACENTERS, AddonOption, ServerConfig } from '@/types';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import ServerDebug from '../debug/ServerDebug';

interface ServerCardProps {
  server: FormattedServer;
  datacenterAvailability: Record<string, Record<string, string>>;
  checkedServers: string[];
  onCheckAvailability: (planCode: string, options?: AddonOption[]) => Promise<any>;
  lastChecked?: string;
}

const ServerCard: React.FC<ServerCardProps> = ({
  server,
  datacenterAvailability,
  checkedServers,
  onCheckAvailability,
  lastChecked
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);
  const [localLastChecked, setLocalLastChecked] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // 选择的配置项
  const [selectedMemory, setSelectedMemory] = useState<string | null>(null);
  const [selectedStorage, setSelectedStorage] = useState<string | null>(null);
  const [selectedBandwidth, setSelectedBandwidth] = useState<string | null>(null);
  const [selectedVrack, setSelectedVrack] = useState<string | null>(null);
  
  // 显示的规格
  const [displayedMemory, setDisplayedMemory] = useState(server.memory);
  const [displayedStorage, setDisplayedStorage] = useState(server.storage);
  const [displayedBandwidth, setDisplayedBandwidth] = useState(server.bandwidth);
  const [displayedVrack, setDisplayedVrack] = useState(server.vrack);
  
  // 配置已变更标记
  const [configChanged, setConfigChanged] = useState(false);
  // 配置已确认标记
  const [configConfirmed, setConfigConfirmed] = useState(false);
  
  // 选中的数据中心
  const [selectedDatacenters, setSelectedDatacenters] = useState<string[]>([]);
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const isChecked = checkedServers.includes(server.planCode);
  
  // 初始化默认选择项
  useEffect(() => {
    // 尝试从本地存储恢复已确认的配置
    const savedConfigStr = localStorage.getItem(`confirmedConfig_${server.planCode}`);
    
    if (savedConfigStr) {
      try {
        const savedConfig = JSON.parse(savedConfigStr);
        
        // 恢复保存的配置选择
        if (savedConfig.memory) {
          setSelectedMemory(savedConfig.memory.code);
          setDisplayedMemory(savedConfig.memory.display);
        }
        
        if (savedConfig.storage) {
          setSelectedStorage(savedConfig.storage.code);
          setDisplayedStorage(savedConfig.storage.display);
        }
        
        if (savedConfig.bandwidth) {
          setSelectedBandwidth(savedConfig.bandwidth.code);
          setDisplayedBandwidth(savedConfig.bandwidth.display);
        }
        
        if (savedConfig.vrack) {
          setSelectedVrack(savedConfig.vrack.code);
          setDisplayedVrack(savedConfig.vrack.display);
        }
        
        // 恢复确认状态
        setConfigConfirmed(true);
        setConfigChanged(false);
        
        console.log(`从本地存储恢复了服务器 ${server.planCode} 的已确认配置`);
        return;
      } catch (e) {
        console.error('恢复保存的配置时出错:', e);
      }
    }
    
    // 如果没有保存的配置或恢复失败，使用默认选择
    if (server.memoryOptions && server.memoryOptions.length > 0) {
      const defaultOption = server.memoryOptions.find(opt => 
        opt.formatted === server.memory
      );
      if (defaultOption) {
        setSelectedMemory(defaultOption.code);
      }
    }
    
    if (server.storageOptions && server.storageOptions.length > 0) {
      const defaultOption = server.storageOptions.find(opt => 
        opt.formatted === server.storage
      );
      if (defaultOption) {
        setSelectedStorage(defaultOption.code);
      }
    }
    
    if (server.bandwidthOptions && server.bandwidthOptions.length > 0) {
      const defaultOption = server.bandwidthOptions.find(opt => 
        opt.formatted === server.bandwidth
      );
      if (defaultOption) {
        setSelectedBandwidth(defaultOption.code);
      }
    }
    
    if (server.vrackOptions && server.vrackOptions.length > 0) {
      const defaultOption = server.vrackOptions.find(opt => 
        opt.formatted === server.vrack
      );
      if (defaultOption) {
        setSelectedVrack(defaultOption.code);
      } else {
        // 如果没有匹配的默认vRack选项，设置为"无vRack"
        setDisplayedVrack("无vRack");
      }
    } else {
      // 如果没有vRack选项，设置为"无vRack"
      setDisplayedVrack("无vRack");
    }
  }, [server]);
  
  // 在组件挂载时和每次检查状态变化时获取最新的上次检查时间
  useEffect(() => {
    const storedTime = localStorage.getItem(`lastChecked_${server.planCode}`);
    if (storedTime) {
      setLocalLastChecked(storedTime);
    }
  }, [server.planCode, isChecked, checkedServers]);
  
  // 获取可用性信息
  const getAvailabilityInfo = (datacenterId: string) => {
    const serverAvailability = datacenterAvailability[server.planCode];
    
    // 将数据中心ID转为小写以匹配API返回的格式
    const dcIdLowerCase = datacenterId.toLowerCase();
    
    console.log(`服务器 ${server.planCode} 数据中心 ${datacenterId} 获取可用性:`, 
      serverAvailability ? serverAvailability[dcIdLowerCase] : 'no data',
      '完整可用性数据:', serverAvailability);
    
    if (!serverAvailability) {
      return { availability: 'unknown', icon: <Clock className="h-4 w-4 text-muted-foreground" />, label: '未检查' };
    }
    
    // 使用小写ID查找对应状态
    const availability = serverAvailability[dcIdLowerCase];
    console.log(`数据中心 ${datacenterId} 的可用性状态:`, availability);
    
    // 未知状态
    if (!availability || availability === 'unknown') {
      return { 
        availability: 'unknown', 
        icon: <Clock className="h-4 w-4 text-muted-foreground" />,
        label: '未知'
      };
    }
    
    // 无货状态
    if (availability === 'unavailable') {
      return { 
        availability: 'unavailable', 
        icon: <XCircle className="h-4 w-4 text-tech-red" />,
        label: '无货'
      };
    }
    
    // 如果包含常见的无货关键词
    if (availability.includes('unavailable') || 
        availability.includes('out') || 
        availability.includes('none')) {
      return { 
        availability: 'unavailable', 
        icon: <XCircle className="h-4 w-4 text-tech-red" />,
        label: '无货'
      };
    }
    
    // 处理OVH特殊的可用性状态格式
    // 这是关键修改：除了unavailable和unknown外都视为可用
    
    // 检查是否含有小时信息（如24H, 1H, 72H等）
    const hourMatch = /(\d+)h/i.exec(availability) || /(\d+)H/.exec(availability);
    const hours = hourMatch ? hourMatch[1] : null;
    
    // 检查是否含有库存等级信息
    const hasHighStock = availability.toLowerCase().includes('high');
    const hasLowStock = availability.toLowerCase().includes('low');
    
    // 根据时间信息和库存信息来确定显示标签和图标颜色
    let label = '有货';
    let returnAvailability = 'available';
    let icon = <CheckCircle className="h-4 w-4 text-tech-green" />;
    
    if (hours) {
      if (parseInt(hours) <= 1) {
        // 1小时内可用，通常是立即可用
        label = hasLowStock ? `${hours}小时内(库存有限)` : `${hours}小时内(可用)`;
      } else if (parseInt(hours) <= 24) {
        // 24小时内可用
        label = `${hours}小时内可用`;
        // 如果是临时可用，使用黄色图标
        icon = <AlertCircle className="h-4 w-4 text-tech-yellow" />;
        returnAvailability = 'soon';
      } else {
        // 超过24小时，如72H等
        label = `${hours}小时内可用`;
        // 如果是未来可用，使用黄色图标
        icon = <AlertCircle className="h-4 w-4 text-tech-yellow" />;
        returnAvailability = 'soon';
      }
    } else if (hasHighStock) {
      label = '库存充足';
    } else if (hasLowStock) {
      label = '库存有限';
      // 库存有限使用黄色图标
      icon = <AlertCircle className="h-4 w-4 text-tech-yellow" />;
      returnAvailability = 'soon';
    } else if (availability === 'available') {
      label = '有货';
    } else {
      // 其他未知的可用状态，保留原始状态文本
      label = availability;
    }
    
    return { 
      availability: returnAvailability, 
      icon: icon,
      label: label
    };
  };
  
  // 检查数据中心是否已被检查可用性
  const hasBeenCheckedAvailability = (datacenterId: string) => {
    const serverAvailability = datacenterAvailability[server.planCode];
    if (!serverAvailability) return false;
    
    const dcIdLowerCase = datacenterId.toLowerCase();
    return isChecked && Boolean(serverAvailability[dcIdLowerCase]);
  };
  
  // 收集当前选择的配置选项
  const getSelectedOptions = () => {
    const options = [];
    
    if (selectedMemory) {
      options.push({ 
        label: 'memory', 
        value: selectedMemory 
      });
    }
    
    if (selectedStorage) {
      options.push({ 
        label: 'storage', 
        value: selectedStorage 
      });
    }
    
    if (selectedBandwidth) {
      options.push({ 
        label: 'bandwidth', 
        value: selectedBandwidth 
      });
    }
    
    if (selectedVrack) {
      options.push({ 
        label: 'vrack', 
        value: selectedVrack 
      });
    }
    
    console.log("生成选项列表:", options);
    return options;
  };
  
  // 选择配置项
  const handleSelectOption = (family: string, optionCode: string, displayText: string) => {
    // 检查是否真的更改了选项
    let isRealChange = false;
    
    switch (family) {
      case 'memory':
        isRealChange = selectedMemory !== optionCode;
        setSelectedMemory(optionCode);
        setDisplayedMemory(displayText);
        break;
      case 'storage':
        isRealChange = selectedStorage !== optionCode;
        setSelectedStorage(optionCode);
        setDisplayedStorage(displayText);
        break;
      case 'bandwidth':
        isRealChange = selectedBandwidth !== optionCode;
        setSelectedBandwidth(optionCode);
        setDisplayedBandwidth(displayText);
        break;
      case 'vrack':
        isRealChange = selectedVrack !== optionCode;
        setSelectedVrack(optionCode);
        setDisplayedVrack(displayText);
        break;
    }
    
    // 只有当真正改变了选项时才更新状态
    if (isRealChange) {
      // 标记配置已变更，但不重置确认状态
      // 只有在用户点击确认按钮时，才会重新检查和设置确认状态
      setConfigChanged(true);
      
      console.log(`已选择 ${family} 配置: ${optionCode} (${displayText}), 配置已更改，需要确认整体配置`);
    } else {
      console.log(`重新选择了相同的 ${family} 配置: ${optionCode} (${displayText}), 无需更改状态`);
    }
  };
  
  // 检查服务器所选配置的可用性并确认配置
  const handleCheckConfigAvailability = async () => {
    setIsChecking(true);
    try {
      // 获取当前选择的配置选项
      const options = getSelectedOptions();
      console.log("检查配置可用性，选择的配置:", options);
      
      // 传递选项参数进行可用性检查
      await onCheckAvailability(server.planCode, options);
      
      // 标记配置已确认并重置变更标记
      setConfigConfirmed(true);
      setConfigChanged(false);
      
      // 保存当前确认的配置，以便在用户离开页面后也能恢复
      const confirmedConfig = {
        memory: { code: selectedMemory, display: displayedMemory },
        storage: { code: selectedStorage, display: displayedStorage },
        bandwidth: { code: selectedBandwidth, display: displayedBandwidth },
        vrack: { code: selectedVrack, display: displayedVrack }
      };
      localStorage.setItem(`confirmedConfig_${server.planCode}`, JSON.stringify(confirmedConfig));
      
      toast({
        title: "整体配置已确认",
        description: "您选择的所有配置项已确认，可以添加到抢购队列",
        variant: "default",
      });
    } catch (error) {
      console.error('检查所选配置可用性失败:', error);
      toast({
        title: "检查失败",
        description: "无法检查所选配置可用性，请重试",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };
  
  // 检查默认服务器可用性(不带配置选项)
  const handleCheckDefaultAvailability = async () => {
    setIsChecking(true);
    try {
      // 不传递选项参数，使用默认配置检查可用性
      await onCheckAvailability(server.planCode);
      
      // 设置配置已确认标记（默认配置）
      setConfigConfirmed(true);
      
      toast({
        title: "默认配置已确认",
        description: "默认配置已确认，可以添加到抢购队列",
        variant: "default",
      });
    } catch (error) {
      console.error('检查可用性失败:', error);
    } finally {
      setIsChecking(false);
    }
  };
  
  // 切换数据中心选择
  const toggleDatacenter = (datacenterId: string) => {
    setSelectedDatacenters(prev => {
      if (prev.includes(datacenterId)) {
        return prev.filter(id => id !== datacenterId);
      } else {
        return [...prev, datacenterId];
      }
    });
  };
  
  // 添加到抢购队列
  const handleAddToQueue = async () => {
    try {
      setIsAddingToQueue(true);
      
      // 如果没有选择数据中心，显示提示
      if (selectedDatacenters.length === 0) {
        toast({
          title: "未选择数据中心",
          description: "请至少选择一个数据中心添加到抢购队列",
          variant: "destructive",
        });
        setIsAddingToQueue(false);
        return;
      }
      
      // 在开始前显示提示
      toast({
        title: "正在添加...",
        description: `正在将 ${server.name} 添加到抢购队列`,
      });
      
      // 收集已选择的配置并转换为后端期望的格式
      const frontendOptions = getSelectedOptions();
      console.log("前端选项格式:", frontendOptions);
      
      // 为每个选中的数据中心创建任务
      for (const datacenterId of selectedDatacenters) {
        // 创建服务器配置对象
        const serverConfig: ServerConfig = {
          name: `${server.name} (${datacenterId})`,
          planCode: server.planCode,
          options: frontendOptions, // 前端选项现在已经是后端期望的格式
          duration: "P1M", // ISO 8601 duration 格式，"P1M"代表一个月
          datacenter: datacenterId,
          quantity: 1, // 默认数量
          os: "none_64.en", // 使用正确的默认操作系统值
          maxRetries: -1, // 设置为无限重试
          taskInterval: 60 // 设置为60秒间隔
        };
        
        console.log(`为数据中心 ${datacenterId} 发送配置:`, serverConfig);
        
        // 调用API创建抢购任务
        await apiService.createTask(serverConfig);
      }
      
      // 更新任务列表
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      // 显示成功消息
      toast({
        title: "添加成功",
        description: `已将 ${server.name} 添加到抢购队列，共 ${selectedDatacenters.length} 个数据中心`,
        variant: "default",
      });
      
      // 清空选择的数据中心
      setSelectedDatacenters([]);
      
      // 导航到抢购队列页面
      navigate('/queue');
    } catch (error) {
      console.error('添加到抢购队列失败:', error);
      toast({
        title: "添加失败",
        description: "无法将服务器添加到抢购队列，请重试",
        variant: "destructive",
      });
    } finally {
      setIsAddingToQueue(false);
    }
  };
  
  // 获取格式化的上次检查时间
  const getLastCheckedTime = (): string | null => {
    // 优先使用传入的lastChecked，其次使用本地state，最后尝试直接从localStorage读取
    const timeToUse = lastChecked || localLastChecked || localStorage.getItem(`lastChecked_${server.planCode}`);
    
    if (!timeToUse) return null;
    
    try {
      return formatDistanceToNow(new Date(timeToUse), { addSuffix: true, locale: zhLocale });
    } catch (e) {
      return null;
    }
  };
  
  // 判断是否有可选配置项
  const hasOptions = (
    (server.memoryOptions && server.memoryOptions.length > 0) ||
    (server.storageOptions && server.storageOptions.length > 0) ||
    (server.bandwidthOptions && server.bandwidthOptions.length > 0) ||
    (server.vrackOptions && server.vrackOptions.length > 0)
  );
  
  return (
    <Card className="tech-card h-full group">
      <CardHeader className="pb-2">
        <div className="flex justify-between">
          <CardTitle className="text-base font-medium">
            {server.name}
          </CardTitle>
          <Server className="h-5 w-5 text-tech-blue opacity-70" />
        </div>
        <CardDescription className="line-clamp-1" title={server.description}>
          {server.description || server.planCode}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex items-center text-sm">
            <Cpu className="h-4 w-4 mr-2 text-muted-foreground" />
            <span>{server.cpu}</span>
          </div>
          <div className="flex items-center text-sm">
            <MemoryStick className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className={
              configConfirmed 
                ? "text-tech-green font-medium" 
                : configChanged ? "text-tech-blue font-medium" : ""
            }>
              {displayedMemory}
            </span>
            {configConfirmed && (
              <Check className="h-3 w-3 ml-1 text-tech-green" />
            )}
          </div>
          <div className="flex items-center text-sm">
            <HardDrive className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className={
              configConfirmed 
                ? "text-tech-green font-medium" 
                : configChanged ? "text-tech-blue font-medium" : ""
            }>
              {displayedStorage}
            </span>
            {configConfirmed && (
              <Check className="h-3 w-3 ml-1 text-tech-green" />
            )}
          </div>
          <div className="flex items-center text-sm">
            <Radio className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className={
              configConfirmed 
                ? "text-tech-green font-medium" 
                : configChanged ? "text-tech-blue font-medium" : ""
            }>
              {displayedBandwidth}
            </span>
            {configConfirmed && (
              <Check className="h-3 w-3 ml-1 text-tech-green" />
            )}
          </div>
          <div className="flex items-center text-sm">
            <Database className="h-4 w-4 mr-2 text-muted-foreground" />
            <span className={
              displayedVrack === "无vRack"
                ? "text-muted-foreground" 
                : configConfirmed 
                  ? "text-tech-green font-medium" 
                  : configChanged ? "text-tech-blue font-medium" : ""
            }>
              {displayedVrack}
            </span>
            {configConfirmed && displayedVrack !== "无vRack" && (
              <Check className="h-3 w-3 ml-1 text-tech-green" />
            )}
          </div>
        </div>
        
        {/* 显示可选配置参数 */}
        {hasOptions && (
          <div className="mt-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs flex items-center w-full justify-center border border-dashed"
              onClick={() => setShowDetails(!showDetails)}
            >
              <Settings className="h-3 w-3 mr-1" />
              {showDetails ? "隐藏配置选项" : "自定义配置选项"}
            </Button>
            
            {showDetails && (
              <div className="mt-2 border rounded-md p-2">
                <Tabs defaultValue="memory">
                  <TabsList className="grid w-full grid-cols-4 h-8">
                    <TabsTrigger value="memory" className="text-xs">内存</TabsTrigger>
                    <TabsTrigger value="storage" className="text-xs">存储</TabsTrigger>
                    <TabsTrigger value="bandwidth" className="text-xs">带宽</TabsTrigger>
                    <TabsTrigger value="vrack" className="text-xs">vRack</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="memory" className="pt-2">
                    {server.memoryOptions && server.memoryOptions.length > 0 ? (
                      <ul className="space-y-1 text-xs">
                        {server.memoryOptions.map(option => {
                          const isSelected = selectedMemory === option.code;
                          return (
                            <li 
                              key={option.code} 
                              className={`flex items-center p-1 rounded cursor-pointer ${
                                isSelected ? 'bg-tech-blue/10 text-tech-blue border border-tech-blue/50' : 'hover:bg-muted'
                              }`}
                              onClick={() => handleSelectOption('memory', option.code, option.formatted)}
                            >
                              {isSelected ? (
                                <Check className="h-3 w-3 mr-1 text-tech-blue" />
                              ) : (
                                <MemoryStick className="h-3 w-3 mr-1 text-muted-foreground" />
                              )}
                              {option.formatted}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">无可选内存配置</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="storage" className="pt-2">
                    {server.storageOptions && server.storageOptions.length > 0 ? (
                      <ul className="space-y-1 text-xs">
                        {server.storageOptions.map(option => {
                          const isSelected = selectedStorage === option.code;
                          return (
                            <li 
                              key={option.code} 
                              className={`flex items-center p-1 rounded cursor-pointer ${
                                isSelected ? 'bg-tech-blue/10 text-tech-blue border border-tech-blue/50' : 'hover:bg-muted'
                              }`}
                              onClick={() => handleSelectOption('storage', option.code, option.formatted)}
                            >
                              {isSelected ? (
                                <Check className="h-3 w-3 mr-1 text-tech-blue" />
                              ) : (
                                <HardDrive className="h-3 w-3 mr-1 text-muted-foreground" />
                              )}
                              {option.formatted}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">无可选存储配置</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="bandwidth" className="pt-2">
                    {server.bandwidthOptions && server.bandwidthOptions.length > 0 ? (
                      <ul className="space-y-1 text-xs">
                        {server.bandwidthOptions.map(option => {
                          const isSelected = selectedBandwidth === option.code;
                          return (
                            <li 
                              key={option.code} 
                              className={`flex items-center p-1 rounded cursor-pointer ${
                                isSelected ? 'bg-tech-blue/10 text-tech-blue border border-tech-blue/50' : 'hover:bg-muted'
                              }`}
                              onClick={() => handleSelectOption('bandwidth', option.code, option.formatted)}
                            >
                              {isSelected ? (
                                <Check className="h-3 w-3 mr-1 text-tech-blue" />
                              ) : (
                                <Radio className="h-3 w-3 mr-1 text-muted-foreground" />
                              )}
                              {option.formatted}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">无可选带宽配置</p>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="vrack" className="pt-2">
                    {server.vrackOptions && server.vrackOptions.length > 0 ? (
                      <ul className="space-y-1 text-xs">
                        {server.vrackOptions.map(option => {
                          const isSelected = selectedVrack === option.code;
                          return (
                            <li 
                              key={option.code} 
                              className={`flex items-center p-1 rounded cursor-pointer ${
                                isSelected ? 'bg-tech-blue/10 text-tech-blue border border-tech-blue/50' : 'hover:bg-muted'
                              }`}
                              onClick={() => handleSelectOption('vrack', option.code, option.formatted)}
                            >
                              {isSelected ? (
                                <Check className="h-3 w-3 mr-1 text-tech-blue" />
                              ) : (
                                <Radio className="h-3 w-3 mr-1 text-muted-foreground" />
                              )}
                              {option.formatted}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">无可选vRack配置</p>
                    )}
                  </TabsContent>

                  {/* 当前已选配置汇总 */}
                  <div className="mt-3 p-2 bg-muted/20 rounded-md border border-dashed">
                    <h4 className="text-xs font-medium mb-1">当前已选配置</h4>
                    <div className="grid grid-cols-2 gap-1">
                      <div className="flex items-center text-xs">
                        <MemoryStick className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className="text-tech-blue">{displayedMemory}</span>
                      </div>
                      <div className="flex items-center text-xs">
                        <HardDrive className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className="text-tech-blue">{displayedStorage}</span>
                      </div>
                      <div className="flex items-center text-xs">
                        <Radio className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className="text-tech-blue">{displayedBandwidth}</span>
                      </div>
                      <div className="flex items-center text-xs">
                        <Database className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className={
                          displayedVrack === "无vRack" 
                            ? "text-muted-foreground" 
                            : "text-tech-blue"
                        }>
                          {displayedVrack}
                        </span>
                      </div>
                    </div>
                  </div>
                </Tabs>
                
                {/* 确认配置按钮 */}
                <Button 
                  variant={configChanged ? "default" : "outline"}
                  size="sm" 
                  className={`w-full mt-4 text-xs ${configChanged ? "bg-tech-blue hover:bg-tech-blue/90" : ""}`}
                  disabled={isChecking}
                  onClick={handleCheckConfigAvailability}
                >
                  {isChecking ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      检查所选配置中...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3 w-3 mr-1" />
                      {configConfirmed ? "已确认当前配置" : "确认当前全部配置"}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
        
        <div className="tech-separator"></div>
        
        <div className="flex justify-between items-center">
          <div className="text-base font-medium">
            {server.price}
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8"
              disabled={isChecking}
              onClick={handleCheckDefaultAvailability}
            >
              {isChecking ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  检查中
                </>
              ) : (
                <>
                  <Monitor className="h-4 w-4 mr-1" />
                  确认默认配置
                </>
              )}
            </Button>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground mt-1">
          {(isChecked || localLastChecked) && getLastCheckedTime() && (
            <div>最后检查: {getLastCheckedTime()}</div>
          )}
          {configChanged && (
            <div className="text-tech-blue">* 配置已更改，请确认配置</div>
          )}
          {configConfirmed && (
            <div className="text-tech-green">* 配置已确认，可以添加到抢购队列</div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col pt-2 pb-3 px-6">
        {/* 选择数据中心区域 */}
        <div className="w-full mb-3">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <p className="text-xs font-medium text-foreground">数据中心</p>
              {selectedDatacenters.length > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-tech-blue/10 text-tech-blue text-xs rounded-md font-medium">
                  已选择 {selectedDatacenters.length}
                </span>
              )}
            </div>
            {selectedDatacenters.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 py-0 text-xs text-tech-red hover:text-white hover:bg-tech-red"
                onClick={() => setSelectedDatacenters([])}
              >
                <X className="h-3 w-3 mr-1" />
                清除选择
              </Button>
            )}
          </div>
          
          {/* 数据中心选择网格 */}
          <div className="grid grid-cols-2 gap-3">
            {DATACENTERS.map((dc) => {
              const availInfo = getAvailabilityInfo(dc.code);
              const isAvailable = availInfo.availability === 'available' || availInfo.availability === 'soon';
              const isUnavailable = availInfo.availability === 'unavailable';
              const isSelected = selectedDatacenters.includes(dc.code);
              const hasBeenChecked = hasBeenCheckedAvailability(dc.code);
              
              // 区域颜色和图标
              let regionColor = "bg-gray-700";
              let regionTextColor = "text-gray-300";
              let regionIcon = <Clock className="h-4 w-4 text-gray-400" />;
              
              if (dc.country.includes("法国") || dc.country.includes("德国") || dc.country.includes("英国")) {
                regionColor = "bg-blue-900";
                regionTextColor = "text-blue-300";
                regionIcon = <Clock className="h-4 w-4 text-blue-400" />;
              } else if (dc.country.includes("美国") || dc.country.includes("加拿大")) {
                regionColor = "bg-amber-900";
                regionTextColor = "text-amber-300";
                regionIcon = <Clock className="h-4 w-4 text-amber-400" />;
              } else if (dc.country.includes("新加坡") || dc.country.includes("澳大利亚") || dc.country.includes("亚")) {
                regionColor = "bg-green-900";
                regionTextColor = "text-green-300";
                regionIcon = <Clock className="h-4 w-4 text-green-400" />;
              }
              
              // 状态样式
              let statusText = "未检查";
              let statusColor = "text-gray-400";
              let statusBg = "";
              let statusBorder = "border-gray-700";
              
              if (hasBeenChecked) {
                if (isAvailable) {
                  statusText = "有货";
                  statusColor = "text-tech-green";
                  statusBg = "bg-tech-green/5";
                  statusBorder = "border-tech-green/30";
                } else if (isUnavailable) {
                  statusText = "无货";
                  statusColor = "text-tech-red";
                  statusBg = "bg-tech-red/5";
                  statusBorder = "border-tech-red/30";
                } else {
                  statusText = "未知";
                  statusColor = "text-gray-400";
                  statusBg = "bg-gray-500/5";
                  statusBorder = "border-gray-700";
                }
              }
              
              // 选中状态样式覆盖
              if (isSelected) {
                statusBg = "bg-tech-blue/10";
                statusBorder = "border-tech-blue";
              }
              
              return (
                <div 
                  key={dc.code} 
                  className={`relative cursor-pointer rounded-lg overflow-hidden transition-all duration-200 
                              border ${statusBorder} ${statusBg} 
                              hover:border-tech-blue/70 hover:shadow-md hover:shadow-tech-blue/10`}
                  onClick={() => toggleDatacenter(dc.code)}
                >
                  {/* 顶部区域栏 */}
                  <div className={`flex items-center justify-between px-2 py-1 ${regionColor}`}>
                    <div className="flex items-center gap-1.5">
                      {regionIcon}
                      <span className={`text-sm font-semibold ${regionTextColor}`}>{dc.code}</span>
                    </div>
                    <span className="text-xs text-gray-300">{dc.country}</span>
                  </div>
                  
                  {/* 中间内容区 */}
                  <div className="px-3 py-2.5 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium truncate max-w-[120px]" title={dc.name}>
                        {dc.name.split('·')[0]}
                      </span>
                      <span className={`text-xs font-medium ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>
                    
                    {/* 底部时间戳或检查按钮 */}
                    {hasBeenChecked ? (
                      <div className="mt-1.5 text-[10px] text-gray-500">
                        {getLastCheckedTime() || "刚刚检查"}
                      </div>
                    ) : (
                      <button 
                        className="mt-1.5 w-full flex items-center justify-center text-xs py-0.5 px-2 rounded 
                                  bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckDefaultAvailability();
                        }}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        检查可用性
                      </button>
                    )}
                  </div>
                  
                  {/* 选中标记 */}
                  {isSelected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-tech-blue flex items-center justify-center">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* 添加抢购按钮区域 - 样式优化 */}
        <div className="w-full">
          <Button 
            size="sm" 
            className={`w-full relative overflow-hidden ${
              !configConfirmed || selectedDatacenters.length === 0 ? 
              'bg-gray-700 hover:bg-gray-600 text-gray-300' : 
              'bg-gradient-to-r from-tech-blue to-tech-blue/80 hover:from-tech-blue/90 hover:to-tech-blue/70 text-white shadow-md shadow-tech-blue/20'
            }`}
            onClick={handleAddToQueue}
            disabled={!configConfirmed || selectedDatacenters.length === 0 || isAddingToQueue}
          >
            {isAddingToQueue ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>添加中...</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                <span>{
                  !configConfirmed ? "请先确认配置" : 
                  selectedDatacenters.length === 0 ? "请选择数据中心" : 
                  `添加抢购 (${selectedDatacenters.length}个数据中心)`
                }</span>
                
                {/* 发光效果，只在启用状态显示 */}
                {configConfirmed && selectedDatacenters.length > 0 && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="w-10 h-full absolute top-0 -left-10 bg-white/10 transform rotate-12 transition-all duration-1000 animate-shine"></div>
                  </div>
                )}
              </>
            )}
          </Button>
        </div>
        
        {/* 添加调试按钮，仅在开发环境显示 */}
        {import.meta.env.DEV && (
          <div className="flex justify-end mt-2">
            <div className="text-xs opacity-40 hover:opacity-100">
              <ServerDebug server={server} />
            </div>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default ServerCard;
