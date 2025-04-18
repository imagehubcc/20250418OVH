import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { apiService } from '@/services/api';
import { 
  ProductCatalog, 
  Plan, 
  ServerAvailability, 
  FormattedServer,
  DatacenterAvailability,
  AddonOption
} from '@/types';

// 辅助函数：格式化插件名称
const formatAddonName = (addonCode: string | null | undefined, addonFamily?: string): string => {
  if (!addonCode) {
    console.log(`[formatAddonName] ${addonFamily} 为空值:`, addonCode);
    return addonFamily === 'vrack' ? '无vRack' : '未知';
  }
  
  console.log(`[formatAddonName] ${addonFamily} 原始值:`, addonCode, typeof addonCode);
  
  // 根据不同插件类型进行格式化
  if (addonFamily === 'memory') {
    // 内存格式化，例如：ram-32g-ecc-2666-24sys -> 32GB RAM ECC 2666MHz
    const match = addonCode && typeof addonCode === 'string' ? addonCode.match(/ram-?(\d+)g/i) : null;
    if (match && match[1]) {
      return `${match[1]}GB RAM`;
    }
    
    // 处理其他可能的格式
    if (addonCode.includes('g-ecc')) {
      const parts = addonCode.split('-');
      for (const part of parts) {
        if (part.match(/\d+g/i)) {
          return `${part.replace('g', '')}GB RAM ECC`;
        }
      }
    }
  }
  
  if (addonFamily === 'storage') {
    // 存储格式化，支持更多格式
    const ssdMatch = addonCode && typeof addonCode === 'string' ? addonCode.match(/(\d+)(?:gb|g)?ssd/i) : null;
    if (ssdMatch && ssdMatch[1]) return `${ssdMatch[1]}GB SSD`;
    
    const nvmeMatch = addonCode && typeof addonCode === 'string' ? addonCode.match(/(\d+)(?:gb|g)?nvme/i) : null;
    if (nvmeMatch && nvmeMatch[1]) return `${nvmeMatch[1]}GB NVMe`;
    
    const hddMatch = addonCode && typeof addonCode === 'string' ? addonCode.match(/(\d+)(?:gb|g)?(?:sa|hdd)/i) : null;
    if (hddMatch && hddMatch[1]) return `${hddMatch[1]}GB HDD`;
    
    // 处理RAID配置 (如：softraid-2x512nvme-24sys)
    const raidMatch = addonCode && typeof addonCode === 'string' ? addonCode.match(/raid-(\d+)x(\d+)(\w+)/i) : null;
    if (raidMatch && raidMatch[1] && raidMatch[2]) {
      const diskCount = raidMatch[1];
      const diskSize = raidMatch[2];
      let diskType = 'HDD';
      
      if (raidMatch[3].includes('nvme')) {
        diskType = 'NVMe';
      } else if (raidMatch[3].includes('ssd')) {
        diskType = 'SSD';
      }
      
      return `${diskCount}×${diskSize}GB ${diskType} RAID`;
    }
  }
  
  if (addonFamily === 'bandwidth' || addonFamily === 'vrack') {
    // 处理特殊情况：vrack是"未知"字符串而不是null
    if (addonFamily === 'vrack' && (addonCode === '未知' || addonCode === 'unknown')) {
      console.log(`[formatAddonName] vrack值为"未知"或"unknown", 返回"无vRack"`);
      return '无vRack';
    }
    
    // 带宽格式化 (如：bandwidth-500-24sys, traffic-5tb-300-24sk-apac)
    // 处理多种格式
    const gbpsMatch = addonCode && typeof addonCode === 'string' ? addonCode.match(/(?:bandwidth|vrack)-(\d+)(?:mbps|gbps)?/i) : null;
    if (gbpsMatch && gbpsMatch[1]) {
      const value = parseInt(gbpsMatch[1]);
      if (value >= 1000) {
        return `${value / 1000}Gbps`;
      }
      return `${value}Mbps`;
    }
    
    // 处理带流量限制的带宽 (如: traffic-5tb-300-24sk-apac)
    const trafficMatch = addonCode && typeof addonCode === 'string' ? addonCode.match(/traffic-(\d+)(?:tb|gb)/i) : null;
    if (trafficMatch && trafficMatch[1]) {
      return `${trafficMatch[1]}TB 流量`;
    }
    
    if (typeof addonCode === 'string') {
      if (addonCode.includes('unmetered') || addonCode.includes('unlimited')) {
        return '不限流量';
      }
    }
  }
  
  // 如果无法匹配任何已知格式
  if (addonFamily === 'vrack') {
    console.log(`[formatAddonName] vrack值无法识别:`, addonCode, '返回无vRack');
    return '无vRack';
  }
  
  // 其他情况返回原始代码
  console.log(`[formatAddonName] ${addonFamily} 无法识别格式:`, addonCode, '返回原值');
  return addonCode;
};

// 解析CPU信息
const parseCpuInfo = (plan: Plan): string => {
  if (!plan) return '未知CPU';
  
  // 首先从invoiceName中提取，通常格式为 "型号 | CPU型号"
  if (plan.invoiceName) {
    const cpuMatch = plan.invoiceName.match(/\|\s*(Intel|AMD)[\s\w-]*/i);
    if (cpuMatch && cpuMatch[0]) {
      return cpuMatch[0].replace('|', '').trim();
    }
  }
  
  // 尝试从名称中提取CPU信息 (支持更多格式)
  if (plan.name && typeof plan.name === 'string') {
    // 匹配常见的CPU型号格式
    const cpuPatterns = [
      /(Intel|AMD)\s+(Core\s+)?(i\d|Xeon|Ryzen|EPYC)[-\s]*([\w\d-]+)/i,  // 匹配完整CPU型号
      /(i\d|Xeon|Ryzen|EPYC)[-\s]*([\w\d-]+)/i,                          // 匹配没有品牌的型号
      /(E3|E5|E7|W|D|N|Gold|Silver|Bronze)[-\s]*(\d{4}[A-Z]*v?\d*)/i     // 匹配Xeon系列型号
    ];
    
    for (const pattern of cpuPatterns) {
      const match = plan.name.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }
  }
  
  // 如果有直接的CPU字段
  if (plan.cpu) {
    return plan.cpu;
  }
  
  // 尝试从描述中提取
  if (plan.description && typeof plan.description === 'string') {
    const descPatterns = [
      /(Intel|AMD)\s+(Core\s+)?(i\d|Xeon|Ryzen|EPYC)[-\s]*([\w\d-]+)/i,
      /(i\d|Xeon|Ryzen|EPYC)[-\s]*([\w\d-]+)/i,
      /(E3|E5|E7|W|D|N|Gold|Silver|Bronze)[-\s]*(\d{4}[A-Z]*v?\d*)/i
    ];
    
    for (const pattern of descPatterns) {
      const match = plan.description.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }
  }
  
  // 从plan.planCode中提取信息
  if (plan.planCode) {
    // KS系列标准命名通常包含CPU系列信息
    if (plan.planCode.startsWith('KS-') || plan.planCode.includes('-KS')) {
      return `Intel Xeon`;  // KS通常是Intel Xeon处理器
    }
  }
  
  return '未知CPU';
};

// 将原始服务器数据转换为前端友好格式
const formatServerData = (catalog: ProductCatalog): FormattedServer[] => {
  if (!catalog?.plans || !Array.isArray(catalog.plans)) {
    return [];
  }
  
  return catalog.plans.map(plan => {
    // 从addonFamilies中获取默认配置
    const getDefaultAddon = (familyName: string) => {
      const family = plan.addonFamilies?.find(f => f.name === familyName);
      return family?.default || null;
    };
    
    // 获取某个类型的所有可选项
    const getAvailableAddons = (familyName: string): Array<{code: string; formatted: string}> => {
      const family = plan.addonFamilies?.find(f => f.name === familyName);
      if (!family || !family.addons || !Array.isArray(family.addons)) {
        return [];
      }
      
      return family.addons.map(addonCode => ({
        code: String(addonCode),
        formatted: formatAddonName(String(addonCode), familyName)
      }));
    };
    
    // 提取默认规格信息
    const memory = formatAddonName(getDefaultAddon('memory'), 'memory') || '未知';
    const storage = formatAddonName(getDefaultAddon('storage'), 'storage') || '未知';
    const bandwidth = formatAddonName(getDefaultAddon('bandwidth'), 'bandwidth') || '未知';
    const vrack = formatAddonName(getDefaultAddon('vrack'), 'vrack') || '无vRack';
    
    // 提取所有可选项
    const memoryOptions = getAvailableAddons('memory');
    const storageOptions = getAvailableAddons('storage');
    const bandwidthOptions = getAvailableAddons('bandwidth');
    const vrackOptions = getAvailableAddons('vrack');
    
    // 处理价格
    let price = '未知';
    if (plan.price) {
      price = plan.price;
    } else if (plan.pricings && plan.pricings.length > 0) {
      const pricing = plan.pricings[0];
      price = `€${(pricing.price / 100000000).toFixed(2)} / 月`;
    }
    
    // 提取CPU信息 - 从invoiceName中获取
    let cpu = '未知CPU';
    if (plan.invoiceName) {
      // 尝试从invoiceName中提取CPU型号，格式通常为 "型号 | CPU型号"
      const cpuMatch = plan.invoiceName.match(/\|\s*(Intel|AMD)[\s\w-]*/i);
      if (cpuMatch && cpuMatch[0]) {
        cpu = cpuMatch[0].replace('|', '').trim();
      }
    }
    
    // 如果上面提取失败，还是尝试使用原来的parseCpuInfo函数
    if (cpu === '未知CPU') {
      cpu = parseCpuInfo(plan);
    }
    
    return {
      planCode: plan.planCode || '',
      name: plan.name || plan.invoiceName || plan.planCode || '',
      description: plan.description || '',
      price,
      cpu,
      memory,
      storage,
      bandwidth,
      vrack,
      // 添加可选项列表
      memoryOptions,
      storageOptions,
      bandwidthOptions,
      vrackOptions,
      // 保留原始数据以便需要时参考
      defaultSpecs: plan.defaultSpecs,
      addonFamilies: plan.addonFamilies
    };
  }).filter(server => server.planCode && server.name); // 过滤掉无效数据
};

export function useServerData() {
  const queryClient = useQueryClient();
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);
  const [datacenterAvailability, setDatacenterAvailability] = useState<Record<string, Record<string, string>>>({});
  const [checkedServers, setCheckedServers] = useState<string[]>([]);
  
  // 服务器列表查询
  const { 
    data: catalog,
    isLoading: isCatalogLoading,
    error: catalogError,
    refetch: refetchCatalog
  } = useQuery({
    queryKey: ['serverCatalog'],
    queryFn: () => apiService.getServers(),
    staleTime: 1000 * 60 * 15, // 15分钟缓存
  });
  
  // 格式化服务器数据
  const servers = catalog ? formatServerData(catalog) : [];
  
  // 获取单个服务器可用性信息
  const fetchAvailability = useCallback(async (server: FormattedServer, options?: AddonOption[]) => {
    if (!server || !server.planCode) {
      console.warn('尝试获取无效服务器的可用性');
      return [];
    }
    
    try {
      console.log(`正在获取服务器 ${server.planCode} 的可用性数据...`);
      
      // 转换选项格式从{family,option}到{label,value}
      let convertedOptions;
      if (options && options.length > 0) {
        convertedOptions = options.map(opt => ({
          label: opt.family,
          value: opt.option
        }));
        console.log(`转换后的选项格式:`, convertedOptions);
      }
      
      // 获取API响应，使用POST方法传递选项参数
      let availabilities;
      if (convertedOptions && convertedOptions.length > 0) {
        availabilities = await apiService.getServerAvailability(server.planCode, convertedOptions);
      } else {
        availabilities = await apiService.getServerAvailability(server.planCode);
      }
      
      console.log(`已接收服务器 ${server.planCode} 的可用性数据:`, JSON.stringify(availabilities, null, 2));
      
      // 直接在本地制作数据中心映射
      const dcAvailability: Record<string, string> = {};
      
      // 处理返回的可用性数据
      if (availabilities && Array.isArray(availabilities) && availabilities.length > 0) {
        // 遍历所有返回项目（可能有多个）
        for (const item of availabilities) {
          // 确保数据中心数组存在
          if (item.datacenters && Array.isArray(item.datacenters)) {
            // 处理每个数据中心
            item.datacenters.forEach((dc: any) => {
              if (dc && dc.datacenter && dc.availability) {
                const datacenterId = dc.datacenter.toLowerCase();
                const availabilityStatus = dc.availability;
                
                console.log(`数据中心: ${datacenterId}, 状态: ${availabilityStatus}`);
                
                // 小写数据中心ID作为键，以确保匹配
                dcAvailability[datacenterId] = availabilityStatus;
              }
            });
          }
        }
      }
      
      console.log(`服务器 ${server.planCode} 最终数据中心可用性映射:`, dcAvailability);
      
      // 使用函数式更新确保获取最新状态
      setDatacenterAvailability(prev => ({
        ...prev,
        [server.planCode]: dcAvailability
      }));
      
      // 标记服务器为已检查
      if (!checkedServers.includes(server.planCode)) {
        setCheckedServers(prev => [...prev, server.planCode]);
      }
      
      // 设置上次检查时间
      const now = new Date().toISOString();
      localStorage.setItem(`lastChecked_${server.planCode}`, now);
      
      return availabilities;
    } catch (error) {
      console.error(`检查服务器 ${server.planCode} 可用性失败:`, error);
      // 即使失败，也标记为已检查，避免重复请求
      if (!checkedServers.includes(server.planCode)) {
        setCheckedServers(prev => [...prev, server.planCode]);
      }
      return [];
    }
  }, [checkedServers, setCheckedServers, setDatacenterAvailability]);
  
  // 批量检查所有服务器的可用性
  const checkAllServersAvailability = useCallback(async () => {
    if (isCheckingAvailability || !servers || servers.length === 0) return;
    
    setIsCheckingAvailability(true);
    setCheckProgress(0);
    
    try {
      // 清空已检查服务器列表
      setCheckedServers([]);
      
      let completedChecks = 0;
      const totalServers = servers.length;
      
      // 批量检查参数
      const BATCH_SIZE = 5;           // 一批次检查5个服务器
      const BATCH_DELAY = 3000;       // 批次间隔3秒
      const REQUEST_DELAY_MIN = 800;  // 单个请求最小延迟0.8秒
      const REQUEST_DELAY_MAX = 2000; // 单个请求最大延迟2秒
      
      // 跟踪已成功检查的服务器
      const checkedServersList: string[] = [];
      // 用于存储所有服务器的可用性数据
      let allAvailabilityData: Record<string, Record<string, string>> = {};
      
      // 将服务器分批处理，避免一次性发送过多请求
      for (let i = 0; i < totalServers; i += BATCH_SIZE) {
        const batch = servers.slice(i, i + BATCH_SIZE);
        
        // 处理一批服务器
        await Promise.all(
          batch.map(async (server) => {
            try {
              // 增加随机延迟，避免请求过于密集
              const delay = REQUEST_DELAY_MIN + Math.random() * (REQUEST_DELAY_MAX - REQUEST_DELAY_MIN);
              await new Promise(resolve => setTimeout(resolve, delay));
              
              // 获取可用性数据（未指定特殊配置选项，使用默认配置）
              const availabilities = await fetchAvailability(server, undefined);
              
              // 检查是否成功获取了可用性数据
              if (availabilities && availabilities.length > 0) {
                checkedServersList.push(server.planCode);
                
                // 提取数据中心可用性到本地变量
                if (datacenterAvailability[server.planCode]) {
                  allAvailabilityData[server.planCode] = datacenterAvailability[server.planCode];
                }
                
                // 设置上次检查时间（确保时间戳一致）
                const now = new Date().toISOString();
                localStorage.setItem(`lastChecked_${server.planCode}`, now);
              }
            } catch (error) {
              console.error(`检查服务器 ${server.planCode} 可用性失败:`, error);
              // 即使单个服务器检查失败，也继续检查其他服务器
            } finally {
              completedChecks++;
              setCheckProgress(Math.floor((completedChecks / totalServers) * 100));
            }
          })
        );
        
        // 如果还有下一批，等待一段时间再继续，避免过于频繁的请求
        if (i + BATCH_SIZE < totalServers) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
      
      // 批量更新检查状态
      setCheckedServers(checkedServersList);
      setDatacenterAvailability(prevState => ({
        ...prevState,
        ...allAvailabilityData
      }));
      
      toast({
        title: "可用性检查完成",
        description: `已完成 ${completedChecks}/${totalServers} 台服务器的可用性检查`,
        variant: "default",
      });
    } catch (error) {
      console.error('批量检查服务器可用性失败:', error);
      toast({
        title: "可用性检查失败",
        description: "批量检查服务器可用性时发生错误",
        variant: "destructive",
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  }, [servers, fetchAvailability, isCheckingAvailability, datacenterAvailability]);
  
  // 检查特定服务器在特定数据中心的可用性
  const checkServerAvailability = useCallback(async (planCode: string, options?: AddonOption[]) => {
    if (!planCode) {
      console.warn('尝试检查无效的服务器planCode');
      return null;
    }
    
    try {
      const server = servers.find(s => s.planCode === planCode);
      if (!server) {
        console.warn(`找不到planCode为 ${planCode} 的服务器`);
        return [];
      }
      
      // 传递配置选项
      return await fetchAvailability(server, options);
    } catch (error) {
      console.error(`检查服务器 ${planCode} 可用性失败:`, error);
      return [];
    }
  }, [servers, fetchAvailability]);
  
  return {
    servers,
    isCatalogLoading,
    catalogError,
    refetchCatalog,
    isCheckingAvailability,
    checkProgress,
    datacenterAvailability,
    checkedServers,
    checkAllServersAvailability,
    checkServerAvailability
  };
}
