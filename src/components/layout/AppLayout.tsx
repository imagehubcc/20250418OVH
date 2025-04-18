
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWebSocket } from '@/hooks/useWebSocket';
import { 
  Server, 
  Home, 
  List, 
  History, 
  Settings, 
  Terminal,
  Menu,
  X,
  Cpu,
  Zap,
  WifiOff
} from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const { isConnected } = useWebSocket();

  // 在窄屏幕上自动关闭侧边栏
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 导航项
  const navItems = [
    { path: '/', icon: <Home className="h-5 w-5" />, label: '仪表盘' },
    { path: '/servers', icon: <Server className="h-5 w-5" />, label: '服务器列表' },
    { path: '/queue', icon: <List className="h-5 w-5" />, label: '抢购队列' },
    { path: '/history', icon: <History className="h-5 w-5" />, label: '抢购历史' },
    { path: '/console', icon: <Terminal className="h-5 w-5" />, label: '控制台' },
    { path: '/settings', icon: <Settings className="h-5 w-5" />, label: '设置' },
  ];

  // 在移动端点击菜单项后关闭菜单
  const handleMobileNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* 顶部导航栏 - 仅在移动端显示 */}
      <header className="flex md:hidden items-center justify-between p-4 bg-tech-navy border-b border-border">
        <div className="flex items-center">
          <button
            className="p-2 text-tech-blue"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <h1 className="ml-2 text-xl font-bold text-tech-blue">
            <span className="text-white">OVH</span> Titan Sniper
          </h1>
        </div>
        <div className="flex items-center">
          {isConnected ? (
            <div className="flex items-center text-tech-green">
              <Zap className="h-4 w-4 mr-1" />
              <span className="text-xs">已连接</span>
            </div>
          ) : (
            <div className="flex items-center text-tech-red">
              <WifiOff className="h-4 w-4 mr-1" />
              <span className="text-xs">未连接</span>
            </div>
          )}
        </div>
      </header>

      {/* 移动端导航菜单 */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-tech-dark/90 backdrop-blur-sm animate-fade-in-up">
          <div className="h-full flex flex-col p-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-tech-blue">
                <span className="text-white">OVH</span> Titan Sniper
              </h2>
              <button 
                className="p-2 text-tech-red"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <nav className="flex-1">
              <ul className="space-y-2">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center p-4 rounded-md transition-all duration-200
                        ${location.pathname === item.path 
                          ? 'bg-tech-blue/20 text-tech-blue'
                          : 'text-foreground hover:bg-muted/30'}`}
                      onClick={handleMobileNavClick}
                    >
                      {item.icon}
                      <span className="ml-3">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="py-4 border-t border-border mt-auto">
              <div className="flex items-center justify-center">
                {isConnected ? (
                  <div className="tech-badge tech-badge-green">
                    <Zap className="h-4 w-4" />
                    <span>已连接到服务器</span>
                  </div>
                ) : (
                  <div className="tech-badge tech-badge-red">
                    <WifiOff className="h-4 w-4" />
                    <span>未连接到服务器</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏导航 - 仅在桌面端显示 */}
        <aside 
          className={`hidden md:block md:w-64 bg-tech-navy text-foreground border-r border-border 
            transition-all duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="h-full flex flex-col p-4">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-xl font-bold text-tech-blue flex items-center">
                <Cpu className="h-6 w-6 mr-2 text-tech-blue animate-pulse-glow" />
                <span>Titan Sniper</span>
              </h1>
            </div>

            <nav className="flex-1">
              <ul className="space-y-1">
                {navItems.map((item) => (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`flex items-center p-3 rounded-md transition-all duration-200
                        ${location.pathname === item.path 
                          ? 'bg-tech-blue/20 text-tech-blue glow-border'
                          : 'text-foreground hover:bg-muted/30'}`}
                    >
                      {item.icon}
                      <span className="ml-3">{item.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="py-4 border-t border-border">
              <div className="flex flex-col space-y-2">
                <div className="tech-badge tech-badge-blue flex justify-center">
                  <span>OVH Titan Sniper v1.0</span>
                </div>
                {isConnected ? (
                  <div className="tech-badge tech-badge-green flex justify-center">
                    <Zap className="h-4 w-4 mr-1" />
                    <span>已连接到服务器</span>
                  </div>
                ) : (
                  <div className="tech-badge tech-badge-red flex justify-center">
                    <WifiOff className="h-4 w-4 mr-1" />
                    <span>未连接到服务器</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* 主内容区域 */}
        <main className="flex-1 overflow-hidden flex flex-col">
          {/* 桌面端顶部信息栏 */}
          <div className="hidden md:flex items-center justify-between h-16 px-6 border-b border-border">
            <div className="flex items-center">
              <button
                className="p-1 text-tech-blue hover:text-tech-purple transition-colors"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <h2 className="ml-4 text-lg font-medium">
                {navItems.find(item => item.path === location.pathname)?.label || '页面'}
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              {isConnected ? (
                <div className="tech-badge tech-badge-green">
                  <Zap className="h-4 w-4 mr-1" />
                  <span>已连接</span>
                </div>
              ) : (
                <div className="tech-badge tech-badge-red">
                  <WifiOff className="h-4 w-4 mr-1" />
                  <span>未连接</span>
                </div>
              )}
            </div>
          </div>

          {/* 内容滚动区域 */}
          <div className="flex-1 overflow-auto">
            <div className="container mx-auto py-6 px-4">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
