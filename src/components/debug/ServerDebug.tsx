import React from 'react';
import { Button } from '@/components/ui/button';
import { FormattedServer } from '@/types';

interface ServerDebugProps {
  server: FormattedServer;
}

const ServerDebug: React.FC<ServerDebugProps> = ({ server }) => {
  const logServerData = () => {
    console.log('Server PlanCode:', server.planCode);
    console.log('Server vRack:', server.vrack);
    console.log('Server vRack Options:', server.vrackOptions);
    console.log('Server Full AddonFamilies:', server.addonFamilies);
    
    // 查找vRack相关的addonFamily
    const vrackFamily = server.addonFamilies?.find(f => f.name === 'vrack');
    console.log('VRack Family:', vrackFamily);
    console.log('VRack Default:', vrackFamily?.default);
    
    // 完整的服务器原始数据
    console.log('Full Server Data:', server);
  };
  
  return (
    <div className="mt-2">
      <Button 
        variant="outline" 
        size="sm"
        onClick={logServerData}
        className="text-xs"
      >
        调试 {server.planCode}
      </Button>
    </div>
  );
};

export default ServerDebug; 