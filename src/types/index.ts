import { WebSocketManager } from '@/services/api';

// API相关类型定义
export interface ApiConfig {
  appKey: string;
  appSecret: string;
  consumerKey: string;
  tgToken: string;
  endpoint: string;
  zone: string;
  iam: string;
  tgChatId: string;
}

// 服务器相关类型定义
export interface ProductCatalog {
  plans: Plan[];
}

export interface Plan {
  planCode: string;
  family?: string;
  category?: string;
  name: string;
  invoiceName?: string;
  description?: string;
  blobs?: any;
  prices?: PriceInfo[];
  price?: string;
  pricings?: any[];
  cpu?: string;
  defaultSpecs?: {
    memory?: string | null;
    storage?: string | null;
    bandwidth?: string | null;
    vrack?: string | null;
  };
  addonFamilies?: AddonFamily[];
}

export interface PriceInfo {
  duration: string;
  price: {
    text: string;
    currencyCode: string;
    value: number;
  };
}

export interface AddonFamily {
  name: string;
  default?: string;
  addons?: Addon[];
  exclusive?: boolean;
  mandatory?: boolean;
}

export interface Addon {
  name: string;
  planCode: string;
  invoiceName?: string;
  prices?: PriceInfo[];
}

export interface ServerAvailability {
  fqn: string;
  planCode: string;
  datacenters: DatacenterAvailability[];
}

export interface DatacenterAvailability {
  datacenter: string;
  availability: string;
}

export interface FormattedServer {
  planCode: string;
  name: string;
  description?: string;
  price: string;
  cpu?: string;
  memory?: string;
  storage?: string;
  bandwidth?: string;
  vrack?: string;
  memoryOptions?: Array<{code: string; formatted: string}>;
  storageOptions?: Array<{code: string; formatted: string}>;
  bandwidthOptions?: Array<{code: string; formatted: string}>;
  vrackOptions?: Array<{code: string; formatted: string}>;
  defaultSpecs?: {
    memory?: string | null;
    storage?: string | null;
    bandwidth?: string | null;
    vrack?: string | null;
  };
  addonFamilies?: AddonFamily[];
}

// 抢购任务相关类型定义
export interface AddonOption {
  family: string;
  option: string;
}

export interface ServerConfig {
  name: string;
  planCode: string;
  options: AddonOption[];
  duration: string;
  datacenter: string;
  quantity: number;
  os: string;
  maxRetries: number;
  taskInterval: number;
}

export interface TaskStatus {
  id: string;
  name: string;
  planCode: string;
  datacenter: string;
  status: string;
  createdAt: string;
  lastChecked?: string;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  message?: string;
}

export interface OrderHistory {
  id: string;
  planCode: string;
  name: string;
  datacenter: string;
  orderTime: string;
  status: string;
  orderId?: string;
  orderUrl?: string;
  error?: string;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warning' | 'error';
  message: string;
}

// WebSocket消息类型定义
export interface WebSocketMessage {
  type: string;
  data: any;
}

// ApiService接口定义
export interface ApiService {
  getApiConfig(): Promise<ApiConfig>;
  setApiConfig(config: ApiConfig): Promise<void>;
  setOvhApiConfig(config: Partial<ApiConfig>): Promise<void>;
  setTelegramConfig(config: Partial<ApiConfig>): Promise<void>;
  clearOvhApiConfig(): Promise<void>;
  clearTelegramConfig(): Promise<void>;
  getServers(subsidiary?: string): Promise<ProductCatalog>;
  getServerAvailability(planCode: string, options?: AddonOption[]): Promise<ServerAvailability[]>;
  getTasks(): Promise<TaskStatus[]>;
  createTask(config: ServerConfig): Promise<TaskStatus>;
  deleteTask(taskId: string): Promise<void>;
  retryTask(taskId: string): Promise<void>;
  clearTasks(): Promise<void>;
  getOrders(): Promise<OrderHistory[]>;
  deleteOrder(orderId: string): Promise<void>;
  clearOrders(): Promise<void>;
  getLogs(limit?: number): Promise<LogEntry[]>;
  clearLogs(): Promise<void>;
  webSocketManager: WebSocketManager | null;
}

// 数据中心信息
export interface Datacenter {
  code: string;
  name: string;
  country: string;
}

// TARGET_PLAN_CODE类型
export const TARGET_PLAN_CODES = [
  "kimsufi-ks-1", 
  "kimsufi-ks-2", 
  "kimsufi-ks-3", 
  "kimsufi-ks-4", 
  "kimsufi-ks-5",
  "kimsufi-ks-6",
  "kimsufi-ks-7"
];

export type TargetPlanCode = typeof TARGET_PLAN_CODES[number];

// 数据中心列表
export const DATACENTERS: Datacenter[] = [
  { code: 'GRA', name: '格拉夫尼茨', country: '法国' },
  { code: 'SBG', name: '斯特拉斯堡', country: '法国' },
  { code: 'RBX', name: '鲁贝', country: '法国' },
  { code: 'BHS', name: '博阿尔诺', country: '加拿大' },
  { code: 'HIL', name: '希尔斯伯勒', country: '美国' },
  { code: 'VIN', name: '维也纳', country: '美国' },
  { code: 'LIM', name: '利马索尔', country: '塞浦路斯' },
  { code: 'SGP', name: '新加坡', country: '新加坡' },
  { code: 'SYD', name: '悉尼', country: '澳大利亚' },
  { code: 'WAW', name: '华沙', country: '波兰' },
  { code: 'FRA', name: '法兰克福', country: '德国' },
  { code: 'LON', name: '伦敦', country: '英国' },
  { code: 'ERI', name: '厄伊沃尔', country: '英国' }
];
