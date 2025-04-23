import React, { useState, useEffect, useMemo } from 'react';
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
  X,
  Badge
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhLocale } from '@/lib/locale';
import { FormattedServer, DatacenterAvailability, DATACENTERS, AddonOption, ServerConfig } from '@/types';
import { useNavigate } from 'react-router-dom';
import { apiService } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import ServerDebug from '../debug/ServerDebug';
import { useMutation } from '@tanstack/react-query';

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
  
  // 添加一个状态来跟踪当前显示的是否为特定配置的可用性
  const [showingConfigSpecificAvailability, setShowingConfigSpecificAvailability] = useState(false);
  // 跟踪当前显示的配置信息（用于UI显示）
  const [currentConfigDisplay, setCurrentConfigDisplay] = useState('');
  
  // 在组件顶部添加一个状态显示当前使用的FQN
  const [currentFQN, setCurrentFQN] = useState<string>('');
  
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const isChecked = checkedServers.includes(server.planCode);
  
  /* 
   * 检查服务器是否有多个真正可选的配置项
   * 如果服务器在任何配置项上只有一个选择，那么这不是真正可选的
   */
  const hasRealOptions = useMemo(() => {
    // 检查每个配置类型是否有多个选项可供选择
    const hasMultipleMemoryOptions = server.memoryOptions && server.memoryOptions.length > 1;
    const hasMultipleStorageOptions = server.storageOptions && server.storageOptions.length > 1;
    const hasMultipleBandwidthOptions = server.bandwidthOptions && server.bandwidthOptions.length > 1;
    const hasMultipleVrackOptions = server.vrackOptions && server.vrackOptions.length > 1;
    
    // 检查服务器是否有任何一项配置有多个选项
    return hasMultipleMemoryOptions || hasMultipleStorageOptions || hasMultipleBandwidthOptions || hasMultipleVrackOptions;
  }, [server.memoryOptions, server.storageOptions, server.bandwidthOptions, server.vrackOptions]);
  
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
        
        // 构建当前配置显示信息
        const configSummary = [];
        if (savedConfig.memory?.display) configSummary.push(savedConfig.memory.display);
        if (savedConfig.storage?.display) configSummary.push(savedConfig.storage.display);
        if (savedConfig.bandwidth?.display) configSummary.push(savedConfig.bandwidth.display);
        if (savedConfig.vrack?.display && savedConfig.vrack.display !== "无vRack") {
          configSummary.push(savedConfig.vrack.display);
        }
        
        setCurrentConfigDisplay(configSummary.join(' | '));
        setShowingConfigSpecificAvailability(true);
        
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
    const storedTime = localStorage.getItem(`lastChecked_${generateConfigFQN()}`);
    if (storedTime) {
      setLocalLastChecked(storedTime);
    }
  }, [server.planCode, isChecked, checkedServers]);
  
  // 添加useEffect更新FQN状态
  useEffect(() => {
    const fqn = generateConfigFQN();
    setCurrentFQN(fqn);
  }, [selectedMemory, selectedStorage, selectedBandwidth, selectedVrack, server.planCode]);
  
  // 修改为纯函数，移除状态更新
  const generateConfigFQN = () => {
    // 如果没有选择任何配置选项，直接返回planCode
    if (!selectedMemory && !selectedStorage && !selectedBandwidth && !selectedVrack) {
      return server.planCode;
    }
    
    // 构建FQN: planCode.memory.storage
    const parts = [server.planCode];
    if (selectedMemory) parts.push(selectedMemory);
    if (selectedStorage) parts.push(selectedStorage);
    
    return parts.join('.');
  };
  
  // 修改getAvailabilityInfo函数，使用配置FQN获取可用性
  const getAvailabilityInfo = (datacenterId: string) => {
    // 获取当前配置的FQN
    const configFQN = generateConfigFQN();
    
    // 首先尝试使用FQN获取可用性数据
    const fqnAvailability = datacenterAvailability[configFQN];
    
    // 如果找不到FQN的数据，回退到使用planCode
    const serverAvailability = fqnAvailability || datacenterAvailability[server.planCode];
    
    // 将数据中心ID转为小写以匹配API返回的格式
    const dcIdLowerCase = datacenterId.toLowerCase();
    
    console.log(`服务器 ${configFQN} 数据中心 ${datacenterId} 获取可用性:`, 
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
  
  // 修改hasBeenCheckedAvailability函数，使用FQN
  const hasBeenCheckedAvailability = (datacenterId: string) => {
    const configFQN = generateConfigFQN();
    const fqnAvailability = datacenterAvailability[configFQN];
    const serverAvailability = fqnAvailability || datacenterAvailability[server.planCode];
    
    if (!serverAvailability) return false;
    
    const dcIdLowerCase = datacenterId.toLowerCase();
    return isChecked && Boolean(serverAvailability[dcIdLowerCase]);
  };
  
  // 收集当前选择的配置选项
  const getSelectedOptions = () => {
    const options = [];
    
    // 记录原始API值和显示值的对应关系
    console.log("准备服务器配置选项 - 使用原始API值:");
    
    // 内存选项
    if (selectedMemory && selectedMemory !== 'default') {
      const memoryOption = server.memoryOptions?.find(opt => opt.code === selectedMemory);
      console.log(`内存选项 - 原始API值: "${selectedMemory}", 显示值: "${memoryOption?.formatted}"`);
      options.push({
        family: 'memory',
        option: selectedMemory // 使用原始API值
      });
    }
    
    // 存储选项
    if (selectedStorage && selectedStorage !== 'default') {
      const storageOption = server.storageOptions?.find(opt => opt.code === selectedStorage);
      console.log(`存储选项 - 原始API值: "${selectedStorage}", 显示值: "${storageOption?.formatted}"`);
      options.push({
        family: 'storage',
        option: selectedStorage // 使用原始API值
      });
    }
    
    // 带宽选项
    if (selectedBandwidth && selectedBandwidth !== 'default') {
      const bandwidthOption = server.bandwidthOptions?.find(opt => opt.code === selectedBandwidth);
      console.log(`带宽选项 - 原始API值: "${selectedBandwidth}", 显示值: "${bandwidthOption?.formatted}"`);
      options.push({
        family: 'bandwidth',
        option: selectedBandwidth // 使用原始API值
      });
    }
    
    // vRack选项
    if (selectedVrack && selectedVrack !== 'default') {
      const vrackOption = server.vrackOptions?.find(opt => opt.code === selectedVrack);
      console.log(`vRack选项 - 原始API值: "${selectedVrack}", 显示值: "${vrackOption?.formatted}"`);
      options.push({
        family: 'vrack',
        option: selectedVrack // 使用原始API值
      });
    }
    
    console.log("最终生成的选项列表(原始API值):", options);
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
      setConfigChanged(true);
      setConfigConfirmed(false);
      // 如果配置已变更，清除特定配置可用性显示状态
      if (showingConfigSpecificAvailability) {
        setShowingConfigSpecificAvailability(false);
      }
      console.log(`已选择 ${family} 配置: ${optionCode} (${displayText}), 配置已更改，需要确认整体配置`);
    } else {
      console.log(`重新选择了相同的 ${family} 配置: ${optionCode} (${displayText}), 无需更改状态`);
    }
  };
  
  // 修改handleCheckConfigAvailability函数，传递配置FQN
  const handleCheckConfigAvailability = async () => {
    setIsChecking(true);
    try {
      // 获取当前选择的配置选项
      const options = getSelectedOptions();
      // 生成配置FQN
      const configFQN = generateConfigFQN();
      
      console.log("检查配置可用性，选择的配置:", options, "FQN:", configFQN);
      
      // 传递FQN和选项参数进行可用性检查
      await onCheckAvailability(configFQN, options);
      
      // 标记配置已确认并重置变更标记
      setConfigConfirmed(true);
      setConfigChanged(false);
      
      // 设置当前显示的是特定配置的可用性
      setShowingConfigSpecificAvailability(true);
      
      // 构建当前配置显示信息
      const configSummary = [];
      if (displayedMemory) configSummary.push(displayedMemory);
      if (displayedStorage) configSummary.push(displayedStorage);
      if (displayedBandwidth) configSummary.push(displayedBandwidth);
      if (displayedVrack && displayedVrack !== "无vRack") configSummary.push(displayedVrack);
      
      setCurrentConfigDisplay(configSummary.join(' | '));
      
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
  
  // 修改handleCheckDefaultAvailability函数，使用服务器默认FQN
  const handleCheckDefaultAvailability = async () => {
    setIsChecking(true);
    try {
      // 不传递选项参数，使用默认配置检查可用性
      // 对于默认配置，我们仍然使用planCode
      await onCheckAvailability(server.planCode);
      
      // 设置配置已确认标记（默认配置）
      setConfigConfirmed(true);
      setConfigChanged(false);
      
      // 设置当前显示的是特定配置的可用性
      setShowingConfigSpecificAvailability(true);
      setCurrentConfigDisplay("默认配置");
      
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
  
  // 获取格式化的上次检查时间
  const getLastCheckedTime = (): string | null => {
    const configFQN = generateConfigFQN();
    // 优先使用传入的lastChecked，其次使用本地state，最后尝试直接从localStorage读取
    const timeToUse = lastChecked || localLastChecked || localStorage.getItem(`lastChecked_${configFQN}`);
    
    if (!timeToUse) return null;
    
    try {
      return formatDistanceToNow(new Date(timeToUse), { addSuffix: true, locale: zhLocale });
    } catch (e) {
      return null;
    }
  };
  
  // 特殊服务器型号列表 - 需要使用无选项下单的服务器
  const specialServers = ["25skc01", "24ska01"];
  // 检查是否是特殊服务器型号
  const isSpecialServer = specialServers.includes(server.planCode);
  
  // **** 定义 isDefaultConfig ****
  const isDefaultConfig = isSpecialServer || !hasRealOptions;
  
  // 添加到抢购队列
  const handleAddToQueue = async () => {
    if (selectedDatacenters.length === 0) {
      toast({ title: "请选择数据中心", description: "请至少选择一个要抢购的数据中心", variant: "destructive" });
      return;
    }

    // 根据 isDefaultConfig 决定执行路径
    if (isDefaultConfig) {
      // ---- 处理默认配置服务器 (调用 /api/queue/new) ----
      setIsAddingToQueue(true);
      try {
        for (const datacenterId of selectedDatacenters) {
          const taskName = `${server.name} (${datacenterId})`;
          console.log(`为服务器 ${server.planCode} 使用默认配置下单 (调用 /api/queue/new)，数据中心: ${datacenterId}`);
          await apiService.createDefaultTask(taskName, server.planCode, datacenterId);
        }
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        toast({ title: "添加成功", description: `已将 ${server.name} 添加到抢购队列 (默认配置)`, variant: "default" });
        setSelectedDatacenters([]);
        navigate('/queue');
      } catch (error) {
        console.error('添加到抢购队列失败 (默认配置):', error);
        toast({ title: "添加失败", description: "无法将服务器添加到抢购队列", variant: "destructive" });
      } finally {
        setIsAddingToQueue(false);
      }
    } else {
      // ---- 处理带选项服务器 (调用 /api/tasks) ----
      // 必须先确认配置
      if (!configConfirmed) {
        toast({ title: "请先确认配置", description: "请点击\"确认当前配置\"按钮", variant: "default" });
        return;
      }

      setIsAddingToQueue(true);
      try {
        for (const datacenterId of selectedDatacenters) {
          const selectedOptionsRaw = getSelectedOptions(); // 获取当前state中的选项
          const backendOptions = selectedOptionsRaw.map(opt => ({ label: opt.family, value: opt.option }));
          const payload = {
            name: `${server.name} (${datacenterId})`,
            planCode: server.planCode,
            datacenter: datacenterId,
            options: backendOptions,
          };
          console.log(`为数据中心 ${datacenterId} 发送精确载荷 (调用 /api/tasks):`, JSON.stringify(payload));
          await apiService.createTask(payload as any);
        }
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        toast({ title: "添加成功", description: `已将 ${server.name} 添加到抢购队列 (${selectedDatacenters.length}个数据中心)`, variant: "default" });
        setSelectedDatacenters([]);
        navigate('/queue');
      } catch (error) {
        console.error('添加到抢购队列失败 (带选项):', error);
        toast({ title: "添加失败", description: "无法将服务器添加到抢购队列", variant: "destructive" });
      } finally {
        setIsAddingToQueue(false);
      }
    }
  };
  
  return (
    <Card className="tech-card h-full group">
      <CardHeader className="pb-2">
        <div className="flex justify-between">
          <CardTitle className="text-base font-medium flex items-center">
            <span>{server.name}</span>
            {/* 使用 isDefaultConfig 控制标识显示 */} 
            {isDefaultConfig && (
              <div className="ml-2 text-xs px-2 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-200">默认配置</div>
            )}
          </CardTitle>
          <Server className="h-5 w-5 text-tech-blue opacity-70" />
        </div>
        <CardDescription className="line-clamp-1" title={server.description}>
          {server.description || server.planCode}
          {/* 使用 isDefaultConfig 控制描述文本 */} 
          {isDefaultConfig && (
            <span className="text-xs text-amber-600 block mt-1">
              此服务器将使用默认配置下单
            </span>
          )}
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
        
        {/* 可选配置 UI - 仅当 !isDefaultConfig 时显示 */} 
        {!isDefaultConfig && (
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
                
                {/* "确认当前配置" 按钮 */} 
                <Button 
                  variant={configChanged ? "default" : "outline"}
                  size="sm" 
                  className={`w-full mt-4 text-xs ${configChanged ? "bg-tech-blue hover:bg-tech-blue/90" : ""}`}
                  disabled={isChecking}
                  onClick={handleCheckConfigAvailability} // 点击调用确认逻辑
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
                      {configConfirmed ? "已确认当前配置" : "确认当前配置"} 
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
          {/* 为默认配置服务器在价格右侧添加检查可用性按钮 */}
          {isDefaultConfig && (
            <Button
              variant="outline"
              size="sm"
              className="flex items-center space-x-1 px-2 py-1 h-auto text-xs" // Smaller padding and text
              onClick={handleCheckDefaultAvailability}
              disabled={isChecking}
            >
              {isChecking ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Radio className="h-3 w-3" /> // Smaller icon
              )}
              <span>{isChecking ? "检查中" : "检查可用性"}</span>
            </Button>
          )}
        </div>
        
        <div className="text-xs text-muted-foreground mt-1">
          {(isChecked || localLastChecked) && getLastCheckedTime() && (
            <div>最后检查: {getLastCheckedTime()}</div>
          )}
          {/* 条件显示状态提示 - 仅当 !isDefaultConfig */} 
          {!isDefaultConfig && configChanged && (
            <div className="text-tech-blue">* 配置已更改，请点击上方"确认当前配置"按钮</div>
          )}
          {!isDefaultConfig && configConfirmed && (
            <div className="text-tech-green">* 配置已确认，可以添加到抢购队列</div>
          )}
        </div>
        
        {/* FQN Debug 信息 */} 
        {import.meta.env.DEV && showingConfigSpecificAvailability && configConfirmed && (
          <div className="mt-1 p-1 bg-gray-800 rounded-md border border-dashed border-gray-700">
            <div className="text-[10px] text-gray-400 flex items-center">
              <Bug className="h-3 w-3 mr-1 text-gray-500" />
              <span>当前FQN: <span className="text-gray-300 font-mono">{currentFQN}</span></span>
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col pt-2 pb-3 px-6">
        {/* 数据中心选择 */} 
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
          <div className="flex flex-col gap-3">
            {/* 添加当前配置可用性状态提示 */}
            {showingConfigSpecificAvailability && (
              <div className="px-3 py-2 bg-tech-blue/10 text-tech-blue rounded-md border border-tech-blue/30">
                <div className="flex items-center text-xs">
                  <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  <span className="font-medium">显示的是已确认配置的可用性</span>
                </div>
                {currentConfigDisplay && (
                  <div className="mt-1 text-[10px] text-tech-blue/80 pl-5">
                    配置: {currentConfigDisplay}
                  </div>
                )}
              </div>
            )}
            
            {!showingConfigSpecificAvailability && configChanged && (
              <div className="px-3 py-2 bg-yellow-500/10 text-yellow-600 rounded-md border border-yellow-500/30">
                <div className="flex items-center text-xs">
                  <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
                  <span className="font-medium">配置已变更，请点击"确认当前全部配置"</span>
                </div>
              </div>
            )}
            
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
        </div>
        
        {/* 主操作按钮 */} 
        <div className="w-full">
          <Button 
            size="sm" 
            className={`w-full relative overflow-hidden ${ 
              isDefaultConfig 
                ? (selectedDatacenters.length === 0 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                    : 'bg-gradient-to-r from-tech-green to-tech-green/80 hover:from-tech-green/90 hover:to-tech-green/70 text-white shadow-md shadow-tech-green/20') // 默认配置按钮样式
                : (!configConfirmed || selectedDatacenters.length === 0 
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-300' 
                    : 'bg-gradient-to-r from-tech-blue to-tech-blue/80 hover:from-tech-blue/90 hover:to-tech-blue/70 text-white shadow-md shadow-tech-blue/20') // 带选项按钮样式
            }`}
            onClick={handleAddToQueue}
            disabled={ // 根据 isDefaultConfig 和 configConfirmed 设置 disabled 状态
              isDefaultConfig 
                ? (selectedDatacenters.length === 0 || isAddingToQueue) // 默认配置：仅检查数据中心选择和加载状态
                : (!configConfirmed || selectedDatacenters.length === 0 || isAddingToQueue) // 带选项：检查配置确认、数据中心选择和加载状态
            }
          >
            {isAddingToQueue ? (
              <>...</> // 加载中指示器
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                <span>{ // 根据 isDefaultConfig 和状态设置按钮文本
                  isDefaultConfig 
                    ? (selectedDatacenters.length === 0 ? "请选择数据中心" : "一键下单") // 默认配置按钮文本
                    : (!configConfirmed ? "请先确认配置" : 
                       selectedDatacenters.length === 0 ? "请选择数据中心" : 
                       `添加抢购 (${selectedDatacenters.length}个数据中心)`) // 带选项按钮文本
                }</span>
                
                {/* 发光效果 */}
                {((isDefaultConfig && selectedDatacenters.length > 0) || 
                 (!isDefaultConfig && configConfirmed && selectedDatacenters.length > 0)) && (
                  <div className="absolute inset-0 overflow-hidden">
                    <div className="w-10 h-full absolute top-0 -left-10 bg-white/10 transform rotate-12 transition-all duration-1000 animate-shine"></div>
                  </div>
                )}
              </>
            )}
          </Button>
        </div>
        
        {/* Debug 按钮 */} 
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
