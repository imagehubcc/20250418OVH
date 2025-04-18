import axios from 'axios';
import { 
  ApiConfig, 
  ProductCatalog, 
  ServerAvailability, 
  ServerConfig, 
  TaskStatus, 
  OrderHistory,
  LogEntry,
  AddonOption,
  ApiService
} from '@/types';

// API基础URL，在生产环境中应配置为实际后端地址
const API_BASE_URL = 'http://localhost:8000';

// 创建Axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API服务类
export const apiService: ApiService = {
  // API配置相关
  async getApiConfig(): Promise<ApiConfig> {
    try {
      const response = await api.get<ApiConfig>('/api/config');
      return response.data;
    } catch (error) {
      console.error('获取API配置失败:', error);
      throw error;
    }
  },

  async setApiConfig(config: ApiConfig): Promise<void> {
    try {
      await api.post('/api/config', config);
    } catch (error) {
      console.error('设置API配置失败:', error);
      throw error;
    }
  },

  // 添加单独更新OVH API配置的方法
  async setOvhApiConfig(config: Partial<ApiConfig>): Promise<void> {
    try {
      // 只发送OVH API相关的字段
      const ovhConfig = {
        appKey: config.appKey,
        appSecret: config.appSecret,
        consumerKey: config.consumerKey,
        endpoint: config.endpoint,
        zone: config.zone,
        iam: config.iam
      };
      await api.post('/api/config/ovh', ovhConfig);
    } catch (error) {
      console.error('设置OVH API配置失败:', error);
      throw error;
    }
  },

  // 添加单独更新Telegram配置的方法
  async setTelegramConfig(config: Partial<ApiConfig>): Promise<void> {
    try {
      // 只发送Telegram相关的字段
      const telegramConfig = {
        tgToken: config.tgToken,
        tgChatId: config.tgChatId
      };
      await api.post('/api/config/telegram', telegramConfig);
    } catch (error) {
      console.error('设置Telegram配置失败:', error);
      throw error;
    }
  },

  // 清除OVH API配置
  async clearOvhApiConfig(): Promise<void> {
    try {
      await api.delete('/api/config/ovh');
    } catch (error) {
      console.error('清除OVH API配置失败:', error);
      throw error;
    }
  },

  // 清除Telegram配置
  async clearTelegramConfig(): Promise<void> {
    try {
      await api.delete('/api/config/telegram');
    } catch (error) {
      console.error('清除Telegram配置失败:', error);
      throw error;
    }
  },

  // 服务器相关
  async getServers(subsidiary: string = 'IE'): Promise<ProductCatalog> {
    try {
      const response = await api.get<ProductCatalog>(`/api/servers?subsidiary=${subsidiary}`);
      
      // 确保返回的数据结构符合预期
      if (!response.data || !response.data.plans) {
        console.warn('API返回的服务器数据结构不完整', response.data);
        // 返回一个有效的空数据结构
        return { plans: [] };
      }
      
      return response.data;
    } catch (error) {
      console.error('获取服务器列表失败:', error);
      // 返回一个有效的空数据结构，而不是抛出错误
      return { plans: [] };
    }
  },

  async getServerAvailability(planCode: string, options?: AddonOption[]): Promise<ServerAvailability[]> {
    try {
      console.log(`正在请求服务器 ${planCode} 的可用性数据...`);
      
      // 构建请求URL和参数
      let url = `/api/servers/${planCode}/availability`;
      let config = {};
      
      // 如果有配置选项，将其作为请求体传递
      if (options && options.length > 0) {
        console.log(`请求包含配置选项:`, options);
        config = {
          data: { options }
        };
      }
      
      const response = await api.get<ServerAvailability[]>(url, config);
      
      console.log(`服务器 ${planCode} 可用性API响应状态:`, response.status);
      
      // 确保响应数据是有效的数组
      if (!response.data) {
        console.warn(`获取服务器 ${planCode} 可用性返回了空数据`);
        return [];
      }
      
      // 处理数据不是数组的情况
      if (!Array.isArray(response.data)) {
        console.warn(`获取服务器 ${planCode} 可用性返回了非数组格式:`, response.data);
        
        // 如果是单个对象，将其转换为数组
        if (typeof response.data === 'object') {
          return [response.data as any];
        }
        
        return [];
      }
      
      // 检查数组内容
      if (response.data.length === 0) {
        console.warn(`获取服务器 ${planCode} 可用性返回了空数组`);
      } else {
        console.log(`获取到 ${response.data.length} 条可用性记录`);
        
        // 验证数据格式
        const firstItem = response.data[0];
        if (!firstItem.datacenters || !Array.isArray(firstItem.datacenters)) {
          console.warn(`可用性数据格式异常，缺少datacenters数组:`, firstItem);
        }
      }
      
      return response.data;
    } catch (error) {
      console.error(`获取服务器 ${planCode} 可用性失败:`, error);
      
      // 返回空数组而不是抛出错误，避免UI崩溃
      return [];
    }
  },

  // 任务相关
  async getTasks(): Promise<TaskStatus[]> {
    try {
      const response = await api.get<TaskStatus[]>('/api/tasks');
      return response.data;
    } catch (error) {
      console.error('获取任务列表失败:', error);
      throw error;
    }
  },

  async createTask(config: ServerConfig): Promise<TaskStatus> {
    try {
      const response = await api.post<TaskStatus>('/api/tasks', config);
      return response.data;
    } catch (error) {
      console.error('创建任务失败:', error);
      throw error;
    }
  },

  async deleteTask(taskId: string): Promise<void> {
    try {
      await api.delete(`/api/tasks/${taskId}`);
    } catch (error) {
      console.error('删除任务失败:', error);
      throw error;
    }
  },

  async retryTask(taskId: string): Promise<void> {
    try {
      await api.post(`/api/tasks/${taskId}/retry`);
    } catch (error) {
      console.error('重试任务失败:', error);
      throw error;
    }
  },

  async clearTasks(): Promise<void> {
    try {
      await api.delete('/api/tasks');
    } catch (error) {
      console.error('清除所有任务失败:', error);
      throw error;
    }
  },

  // 订单相关
  async getOrders(): Promise<OrderHistory[]> {
    try {
      console.log('开始获取订单历史数据...');
      const response = await api.get<OrderHistory[]>('/api/orders');
      console.log(`成功获取到${response.data.length}条订单历史记录`);
      if (response.data.length > 0) {
        console.log('订单IDs:', response.data.map(order => order.orderId).join(', '));
      }
      return response.data;
    } catch (error: any) {
      console.error('获取订单历史失败:', error);
      if (error.response) {
        console.error(`服务器返回状态码: ${error.response.status}`);
        console.error('响应数据:', error.response.data);
      }
      throw error;
    }
  },

  async deleteOrder(orderId: string): Promise<void> {
    try {
      console.log(`开始删除订单: ${orderId}`);
      const response = await api.delete(`/api/orders/${orderId}`);
      console.log(`删除订单成功，服务器返回:`, response.status, response.data);
    } catch (error: any) {
      console.error('删除订单失败:', error);
      if (error.response) {
        // 服务器响应了错误状态码
        console.error(`服务器返回状态码: ${error.response.status}`);
        console.error('响应数据:', error.response.data);
      } else if (error.request) {
        // 请求已发送但没有收到响应
        console.error('没有收到服务器响应:', error.request);
      } else {
        // 设置请求时发生了错误
        console.error('请求设置错误:', error.message);
      }
      throw error;
    }
  },

  async clearOrders(): Promise<void> {
    try {
      await api.delete('/api/orders');
    } catch (error) {
      console.error('清除所有订单失败:', error);
      throw error;
    }
  },

  // 日志相关
  async getLogs(limit: number = 100): Promise<LogEntry[]> {
    try {
      const response = await api.get<LogEntry[]>(`/api/logs?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('获取日志失败:', error);
      throw error;
    }
  },

  // 清除所有日志
  async clearLogs(): Promise<void> {
    try {
      await api.post('/api/logs', { action: 'clear' });
    } catch (error) {
      console.error('清除所有日志失败:', error);
      throw error;
    }
  },

  // WebSocket相关
  webSocketManager: null,
};

// WebSocket连接管理
export class WebSocketManager {
  private ws: WebSocket | null = null;
  private callbacks: Map<string, Function[]> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 2000;
  private messageQueue: any[] = []; // 存储未发送成功的消息
  private connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  private pingInterval: NodeJS.Timeout | null = null;
  private lastPingTime: number = 0;

  // 连接WebSocket
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('WebSocket已经连接，不需要重新连接');
      return;
    }

    if (this.connectionStatus === 'connecting') {
      console.log('WebSocket正在连接中，请稍后再试');
      return;
    }

    this.connectionStatus = 'connecting';
    console.log('正在建立WebSocket连接...');

    try {
      this.ws = new WebSocket(`ws://${API_BASE_URL.replace('http://', '')}/ws`);

      this.ws.onopen = () => {
        console.log('WebSocket连接已建立');
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this.triggerEvent('open', {});
        
        // 发送队列中的消息
        this.processMessageQueue();
        
        // 设置心跳检测
        this.setupPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log(`收到WebSocket消息: ${message.type}`, message.data);
          this.triggerEvent(message.type, message.data);
          this.lastPingTime = Date.now(); // 更新最后通信时间
        } catch (error) {
          console.error('处理WebSocket消息失败:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log(`WebSocket连接已关闭: 代码=${event.code}, 原因=${event.reason}`);
        this.connectionStatus = 'disconnected';
        this.triggerEvent('close', { code: event.code, reason: event.reason });
        this.clearPingInterval();
        this.reconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this.connectionStatus = 'disconnected';
        this.triggerEvent('error', error);
        this.clearPingInterval();
      };
    } catch (error) {
      console.error('创建WebSocket连接失败:', error);
      this.connectionStatus = 'disconnected';
      this.reconnect();
    }
  }

  // 处理消息队列
  private processMessageQueue() {
    if (this.messageQueue.length > 0 && this.isConnected()) {
      console.log(`正在处理${this.messageQueue.length}条待发送消息`);
      while (this.messageQueue.length > 0) {
        const message = this.messageQueue.shift();
        this.send(message);
      }
    }
  }

  // 设置心跳检测
  private setupPingInterval() {
    this.clearPingInterval();
    this.lastPingTime = Date.now();
    
    this.pingInterval = setInterval(() => {
      // 如果30秒内没有收到任何消息，发送ping
      if (Date.now() - this.lastPingTime > 30000) {
        if (this.isConnected()) {
          console.log('发送心跳检测...');
          this.send({ type: 'ping' });
        } else {
          console.warn('连接可能已断开，尝试重连');
          this.reconnect();
        }
      }
    }, 15000); // 每15秒检查一次
  }

  // 清除心跳检测
  private clearPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // 重新连接
  private reconnect() {
    if (this.reconnectTimeout || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    console.log(`尝试重新连接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.reconnectDelay * Math.min(2, this.reconnectAttempts)); // 指数退避
  }

  // 强制重连
  forceReconnect() {
    console.log('强制重新连接WebSocket');
    this.disconnect();
    this.reconnectAttempts = 0;
    this.connect();
  }

  // 关闭连接
  disconnect() {
    this.clearPingInterval();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.connectionStatus = 'disconnected';
    this.reconnectAttempts = 0;
  }

  // 订阅事件
  on(event: string, callback: Function) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)?.push(callback);
  }

  // 取消订阅事件
  off(event: string, callback: Function) {
    if (!this.callbacks.has(event)) {
      return;
    }

    const callbacks = this.callbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // 触发事件
  private triggerEvent(event: string, data: any) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event)?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`执行${event}事件回调时出错:`, error);
        }
      });
    }
  }

  // 发送消息
  send(message: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(message));
        this.lastPingTime = Date.now(); // 更新最后通信时间
      } catch (error) {
        console.error('发送WebSocket消息失败:', error);
        this.messageQueue.push(message);
      }
    } else {
      console.warn('WebSocket未连接，消息已加入队列');
      this.messageQueue.push(message);
      this.connect(); // 尝试重新连接
    }
  }

  // 检查连接状态
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // 获取连接状态
  getConnectionStatus(): string {
    return this.connectionStatus;
  }
}

// 创建WebSocket管理器实例
export const webSocketManager = new WebSocketManager();

// 将WebSocketManager添加到apiService中，使其可以从apiService访问
apiService.webSocketManager = webSocketManager;

// 为了兼容老代码，添加到window对象
if (typeof window !== 'undefined') {
  (window as any).webSocketManager = webSocketManager;
}
