import React, { useState, useMemo } from 'react';
import { useServerData } from '@/hooks/useServerData';
import { FormattedServer, AddonOption } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Monitor, 
  Search, 
  RefreshCw, 
  ServerCrash, 
  Filter, 
  SortAsc, 
  SortDesc,
  X,
  CheckSquare,
  AlertCircle,
  Settings
} from 'lucide-react';
import ServerCard from '@/components/servers/ServerCard';
import { Progress } from '@/components/ui/progress';

const ServersPage: React.FC = () => {
  const {
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
  } = useServerData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'price' | 'name'>('price');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [lastCheckedTime, setLastCheckedTime] = useState<string | null>(null);
  
  // 处理搜索
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };
  
  // 切换排序方向
  const toggleSortDirection = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };
  
  // 设置排序字段
  const handleSortBy = (field: 'price' | 'name') => {
    if (sortBy === field) {
      toggleSortDirection();
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };
  
  // 刷新所有可用性
  const handleRefreshAvailability = () => {
    checkAllServersAvailability();
    
    // 更新上次检查时间
    const now = new Date().toISOString();
    setLastCheckedTime(now);
  };
  
  // 检查单个服务器可用性
  const handleCheckServerAvailability = async (planCode: string, options?: AddonOption[]) => {
    await checkServerAvailability(planCode, options);
    setLastCheckedTime(new Date().toISOString());
  };
  
  // 过滤和排序服务器
  const filteredAndSortedServers = useMemo(() => {
    // 过滤服务器
    const filtered = servers.filter((server) => {
      const queryLower = searchQuery.toLowerCase();
      
      return (
        server.name.toLowerCase().includes(queryLower) ||
        server.planCode.toLowerCase().includes(queryLower) ||
        (server.cpu && server.cpu.toLowerCase().includes(queryLower)) ||
        (server.memory && server.memory.toLowerCase().includes(queryLower)) ||
        (server.storage && server.storage.toLowerCase().includes(queryLower)) ||
        (server.bandwidth && server.bandwidth.toLowerCase().includes(queryLower))
      );
    });
    
    // 排序服务器
    return [...filtered].sort((a, b) => {
      if (sortBy === 'price') {
        // 提取价格数值进行比较
        const getPrice = (priceStr: string) => {
          const match = priceStr.match(/\d+(\.\d+)?/);
          return match ? parseFloat(match[0]) : 0;
        };
        
        const priceA = getPrice(a.price);
        const priceB = getPrice(b.price);
        
        return sortDirection === 'asc' ? priceA - priceB : priceB - priceA;
      } else {
        // 按名称排序
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        
        return sortDirection === 'asc'
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      }
    });
  }, [servers, searchQuery, sortBy, sortDirection]);
  
  // 清除搜索
  const clearSearch = () => {
    setSearchQuery('');
  };
  
  return (
    <div className="space-y-6">
      {/* 顶部标题区域 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">服务器列表</h1>
        <p className="text-muted-foreground">浏览和搜索可用的OVH服务器</p>
      </div>
      
      {/* 搜索和过滤控件 */}
      <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-4">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-muted-foreground" />
          </div>
          <Input
            placeholder="搜索服务器名称、型号、配置..."
            value={searchQuery}
            onChange={handleSearch}
            className="pl-10 h-10"
          />
          {searchQuery && (
            <button
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            className="min-w-[100px]"
            onClick={() => handleSortBy('price')}
          >
            价格
            {sortBy === 'price' && (
              sortDirection === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            className="min-w-[100px]"
            onClick={() => handleSortBy('name')}
          >
            名称
            {sortBy === 'name' && (
              sortDirection === 'asc' ? <SortAsc className="ml-1 h-4 w-4" /> : <SortDesc className="ml-1 h-4 w-4" />
            )}
          </Button>
          <Button
            variant="default"
            className="bg-tech-blue hover:bg-tech-blue/80"
            onClick={handleRefreshAvailability}
            disabled={isCheckingAvailability}
          >
            {isCheckingAvailability ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                检查中...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                刷新可用性
              </>
            )}
          </Button>
        </div>
      </div>
      
      {/* 状态摘要 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center">
          <span className="text-sm mr-2">服务器总数:</span>
          <span className="tech-badge tech-badge-blue">{servers.length}</span>
        </div>
        <div className="flex items-center">
          <span className="text-sm mr-2">已检查:</span>
          <span className="tech-badge tech-badge-purple">{checkedServers.length}</span>
        </div>
        {checkedServers.length > 0 && (
          <div className="flex items-center">
            <CheckSquare className="h-4 w-4 text-tech-green mr-1" />
            <span className="text-sm">已更新服务器可用性</span>
          </div>
        )}
        
        {/* 可用性匹配提示 */}
        <div className="flex items-center ml-2">
          <AlertCircle className="h-4 w-4 text-amber-500 mr-1" />
          <span className="text-sm text-amber-500 font-medium">前端显示的可用性状态仅供参考，实际下单结果以系统反馈为准</span>
        </div>
        
        {/* 可选配置提示 */}
        <div className="flex items-center ml-2">
          <Settings className="h-4 w-4 text-tech-blue mr-1" />
          <span className="text-sm text-tech-blue font-medium">系统已支持自定义附加选项配置订购</span>
        </div>
      </div>
      
      {/* 进度条 */}
      {isCheckingAvailability && (
        <Card className="tech-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <Monitor className="h-4 w-4 text-tech-blue mr-2" />
                <span className="text-sm font-medium">正在检查服务器可用性...</span>
              </div>
              <span className="text-sm">{checkProgress}%</span>
            </div>
            <Progress value={checkProgress} className="h-2" />
          </CardContent>
        </Card>
      )}
      
      {/* 服务器卡片网格 */}
      {isCatalogLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="tech-card h-[300px] animate-pulse">
              <div className="p-6 space-y-4">
                <div className="h-6 bg-muted/40 rounded w-3/4"></div>
                <div className="h-4 bg-muted/40 rounded w-1/2"></div>
                <div className="h-20 bg-muted/40 rounded"></div>
                <div className="h-4 bg-muted/40 rounded w-2/3"></div>
                <div className="h-12 bg-muted/40 rounded"></div>
              </div>
            </Card>
          ))}
        </div>
      ) : catalogError ? (
        <Card className="tech-card p-6 flex flex-col items-center justify-center">
          <ServerCrash className="h-12 w-12 text-tech-red mb-4" />
          <h3 className="text-lg font-medium mb-2">获取服务器列表失败</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            无法获取OVH服务器列表，请稍后重试或检查网络连接
          </p>
          <Button
            variant="default"
            onClick={() => refetchCatalog()}
            className="bg-tech-blue hover:bg-tech-blue/80"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            重试
          </Button>
        </Card>
      ) : filteredAndSortedServers.length === 0 ? (
        <Card className="tech-card p-6 flex flex-col items-center justify-center">
          <Search className="h-12 w-12 text-tech-gray mb-4" />
          <h3 className="text-lg font-medium mb-2">未找到匹配的服务器</h3>
          <p className="text-sm text-muted-foreground mb-4 text-center">
            没有符合当前搜索条件的服务器，请尝试调整搜索条件
          </p>
          <Button variant="outline" onClick={clearSearch}>
            清除搜索
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAndSortedServers.map((server: FormattedServer) => (
            <ServerCard
              key={server.planCode}
              server={server}
              datacenterAvailability={datacenterAvailability}
              checkedServers={checkedServers}
              onCheckAvailability={handleCheckServerAvailability}
              lastChecked={lastCheckedTime}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ServersPage;
