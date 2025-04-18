import asyncio
import json
import logging
import os
import time
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Union, Any
import traceback

import ovh
import requests
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, BackgroundTasks, HTTPException, Depends, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings
from contextlib import asynccontextmanager

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("ovh_sniper.log"),
    ],
)

logger = logging.getLogger("ovh-sniper")

# 配置设置
class Settings(BaseSettings):
    APP_KEY: str = ""
    APP_SECRET: str = ""
    CONSUMER_KEY: str = ""
    ENDPOINT: str = "ovh-eu"
    TG_TOKEN: str = ""
    TG_CHAT_ID: str = ""
    IAM: str = "go-ovh-ie"
    ZONE: str = "IE"
    TARGET_OS: str = "none_64.en"
    TARGET_DURATION: str = "P1M"
    TASK_INTERVAL: int = 60  # 单位：秒

    class Config:
        env_file = ".env"

settings = Settings()

# 数据模型
class ServerAvailability(BaseModel):
    fqn: str
    planCode: str
    datacenters: List[Dict[str, str]]

class ApiConfig(BaseModel):
    appKey: str
    appSecret: str
    consumerKey: str
    endpoint: str = "ovh-eu"
    zone: str = "IE"
    iam: str = "go-ovh-ie"
    tgToken: Optional[str] = None
    tgChatId: Optional[str] = None
    
    def update_api_part(self, api_part: Dict[str, Any]):
        """只更新API相关的配置部分"""
        for key in ["appKey", "appSecret", "consumerKey", "endpoint", "zone", "iam"]:
            if key in api_part:
                setattr(self, key, api_part[key])
        return self
    
    def update_telegram_part(self, tg_part: Dict[str, Any]):
        """只更新Telegram相关的配置部分"""
        for key in ["tgToken", "tgChatId"]:
            if key in tg_part:
                setattr(self, key, tg_part[key])
        return self

class AddonOption(BaseModel):
    label: str    # 选项类别，如"memory", "storage"等
    value: str    # 选项值，如"ram64", "ssd500"等
    price: Optional[str] = None
    description: Optional[str] = None

class ServerConfig(BaseModel):
    planCode: str
    datacenter: str
    quantity: int = 1
    os: str = "none_64.en"
    duration: str = "P1M"
    options: List[AddonOption] = []
    name: str
    maxRetries: int = -1  # -1表示无限重试
    taskInterval: int = 60  # 默认60秒检查一次

class OrderHistory(BaseModel):
    id: str
    planCode: str
    name: str
    datacenter: str
    orderTime: str
    status: str
    orderId: Optional[str] = None
    orderUrl: Optional[str] = None
    error: Optional[str] = None

class TaskStatus(BaseModel):
    id: str
    name: str
    planCode: str
    datacenter: str
    status: str
    createdAt: str
    lastChecked: Optional[str] = None
    retryCount: int = 0
    maxRetries: int = -1
    nextRetryAt: Optional[str] = None
    message: Optional[str] = None
    taskInterval: int = 60  # 添加任务间隔属性，默认60秒
    options: List[AddonOption] = []  # 添加选项字段，保存用户选择的配置

# 添加配置持久化
CONFIG_FILE = "config.json"

# 添加订单历史持久化功能
ORDERS_FILE = "orders.json"

# 添加任务持久化功能
TASKS_FILE = "tasks.json"

# 添加全局字典，用于记录各服务器型号的问题参数
# server_problem_params = {}
# 记录服务器型号尝试次数的字典
# server_attempt_counts = {}
# 最大尝试次数，超过这个次数就使用完全默认配置
# MAX_PARAM_ATTEMPTS = 3

# 添加特定参数类型的初始列表，帮助系统更好地识别和分类参数
# COMMON_PARAM_TYPES = {
#     "memory": ["ram", "memory"],
#     "storage": ["storage", "disk", "hdd", "ssd", "raid", "noraid"],
#     "bandwidth": ["bandwidth", "traffic", "network"]
# }

# 保存配置到文件
def save_config_to_file():
    global api_config
    if api_config:
        try:
            with open(CONFIG_FILE, "w") as f:
                # 转换为字典并保存
                config_dict = api_config.dict()
                # 记录日志，但不包含敏感信息
                log_dict = config_dict.copy()
                for key in ["appKey", "appSecret", "consumerKey", "tgToken"]:
                    if log_dict.get(key):
                        log_dict[key] = "******"
                
                add_log("info", f"保存配置到文件: {log_dict}")
                # 特别记录Telegram相关字段
                add_log("info", f"Telegram配置状态: tgToken={'已设置' if config_dict.get('tgToken') else '未设置'}, " 
                      f"tgChatId={config_dict.get('tgChatId') or '未设置'}")
                
                json.dump(config_dict, f)
            add_log("info", f"API配置已保存到文件 {CONFIG_FILE}")
            
            # 验证文件是否成功保存
            if os.path.exists(CONFIG_FILE):
                file_size = os.path.getsize(CONFIG_FILE)
                add_log("info", f"配置文件存在，大小: {file_size} 字节")
                
                # 尝试读取回来验证内容
                try:
                    with open(CONFIG_FILE, "r") as check_f:
                        saved_config = json.load(check_f)
                        # 验证Telegram相关字段
                        tg_token_saved = bool(saved_config.get("tgToken"))
                        tg_chat_id_saved = bool(saved_config.get("tgChatId"))
                        add_log("info", f"配置验证: tgToken已保存: {tg_token_saved}, tgChatId已保存: {tg_chat_id_saved}")
                except Exception as read_error:
                    add_log("error", f"读取已保存配置进行验证时出错: {str(read_error)}")
            else:
                add_log("error", f"配置文件保存后未找到: {CONFIG_FILE}")
        except Exception as e:
            add_log("error", f"保存API配置到文件失败: {str(e)}")
            add_log("error", f"错误详情: {traceback.format_exc()}")

# 从文件加载配置
def load_config_from_file():
    global api_config
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                config_dict = json.load(f)
                api_config = ApiConfig(**config_dict)
            add_log("info", f"已从文件 {CONFIG_FILE} 加载API配置")
        except Exception as e:
            add_log("error", f"从文件加载API配置失败: {str(e)}")

# 保存订单到文件
def save_orders_to_file():
    global orders
    try:
        with open(ORDERS_FILE, "w") as f:
            # 将订单列表转换为可序列化的字典列表
            serializable_orders = [order.dict() for order in orders]
            json.dump(serializable_orders, f)
        add_log("info", f"订单历史已保存到文件 {ORDERS_FILE}")
    except Exception as e:
        add_log("error", f"保存订单历史到文件失败: {str(e)}")

# 从文件加载订单
def load_orders_from_file():
    global orders
    if os.path.exists(ORDERS_FILE):
        try:
            with open(ORDERS_FILE, "r") as f:
                orders_data = json.load(f)
                orders = [OrderHistory(**order_dict) for order_dict in orders_data]
            add_log("info", f"已从文件 {ORDERS_FILE} 加载 {len(orders)} 条订单历史")
        except Exception as e:
            add_log("error", f"从文件加载订单历史失败: {str(e)}")

# 保存任务到文件
def save_tasks_to_file():
    global tasks
    try:
        with open(TASKS_FILE, "w") as f:
            # 将任务字典转换为可序列化的字典列表
            serializable_tasks = [task.dict() for task in tasks.values()]
            json.dump(serializable_tasks, f)
        add_log("debug", f"任务已保存到文件 {TASKS_FILE}，共 {len(tasks)} 条")
    except Exception as e:
        add_log("error", f"保存任务到文件失败: {str(e)}")

# 从文件加载任务
def load_tasks_from_file():
    global tasks
    if os.path.exists(TASKS_FILE):
        try:
            with open(TASKS_FILE, "r") as f:
                tasks_data = json.load(f)
                # 将列表转换为以任务ID为键的字典
                tasks = {task_dict["id"]: TaskStatus(**task_dict) for task_dict in tasks_data}
            add_log("info", f"已从文件 {TASKS_FILE} 加载 {len(tasks)} 条任务")
        except Exception as e:
            add_log("error", f"从文件加载任务失败: {str(e)}")

# 向订单列表添加新订单并持久化
def add_order(order: OrderHistory):
    global orders
    orders.append(order)
    # 添加后立即保存到文件
    save_orders_to_file()
    add_log("info", f"新订单已添加到历史记录并保存: {order.id}")

# 添加心跳检测和连接状态报告机制

# 每隔一段时间广播连接状态
async def broadcast_connection_status():
    """定期广播服务器状态，确保所有前端组件同步"""
    while True:
        try:
            if connections:  # 只有在有连接时才广播
                await broadcast_message({
                    "type": "connection_status",
                    "data": {
                        "is_connected": True,
                        "active_connections": len(connections),
                        "timestamp": datetime.now().isoformat()
                    }
                })
            await asyncio.sleep(5)  # 每5秒广播一次状态
        except Exception as e:
            add_log("error", f"广播连接状态时出错: {str(e)}")
            await asyncio.sleep(5)  # 出错时等待5秒后重试

# 在lifespan中启动状态广播
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动事件
    # 加载配置和订单历史
    load_config_from_file()
    load_orders_from_file()
    load_tasks_from_file()  # 加载保存的任务
    
    # 启动任务执行循环和状态广播
    asyncio.create_task(task_execution_loop())
    asyncio.create_task(broadcast_connection_status())  # 添加状态广播
    
    add_log("info", "OVH Titan Sniper 后端已启动")
    yield
    # 关闭事件
    # 保存配置和订单历史
    save_config_to_file()
    save_orders_to_file()
    save_tasks_to_file()  # 保存任务
    
    add_log("info", "OVH Titan Sniper 后端已关闭，所有数据已保存")

# 创建应用
app = FastAPI(title="OVH Titan Sniper API", lifespan=lifespan)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境应该限制具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化状态变量
api_config: Optional[ApiConfig] = None
tasks: Dict[str, TaskStatus] = {}
orders: List[OrderHistory] = []
connections: List[WebSocket] = []
logs: List[Dict[str, str]] = []

# OVH客户端实例
ovh_client = None

# WebSocket连接管理
async def broadcast_message(message: Dict[str, Any]):
    """广播消息给所有WebSocket连接"""
    # 只为非日志消息和非心跳消息记录广播信息
    if message['type'] not in ['log', 'ping', 'pong']:
        add_log("debug", f"广播消息: type={message['type']}")
    
    global connections  # 确保我们使用全局连接列表
    disconnected = []
    
    # 在开始前先检查连接是否有效
    for i, websocket in enumerate(connections):
        try:
            # 检查连接是否打开
            if websocket.client_state != 1:  # CONNECTED状态
                add_log("debug", f"连接 {i} 已关闭，标记为断开")
                disconnected.append(websocket)
                continue
                
            await websocket.send_json(message)
            # 取消每次发送的成功日志，减少日志数量
        except WebSocketDisconnect:
            add_log("warning", f"广播消息时发现断开的连接 (索引 {i})")
            disconnected.append(websocket)
        except Exception as e:
            add_log("error", f"广播消息失败 (索引 {i}): {str(e)}")
            # 任何错误都表示连接可能有问题，添加到断开列表
            disconnected.append(websocket)
    
    # 移除已断开的连接
    if disconnected:
        connections = [conn for conn in connections if conn not in disconnected]
        add_log("info", f"已清理 {len(disconnected)} 个断开的WebSocket连接，剩余 {len(connections)} 个活动连接")

def add_log(level: str, message: str):
    timestamp = datetime.now().isoformat()
    log_entry = {
        "timestamp": timestamp,
        "level": level,
        "message": message
    }
    logs.append(log_entry)
    
    # 保持日志数量在合理范围内
    if len(logs) > 1000:
        logs.pop(0)
    
    # 将日志广播给所有连接的客户端
    asyncio.create_task(broadcast_message({
        "type": "log",
        "data": log_entry
    }))

# 初始化OVH客户端
def get_ovh_client():
    global api_config, ovh_client
    
    if not api_config:
        raise HTTPException(status_code=400, detail="API配置未设置，请先配置API")
    
    if not ovh_client:
        try:
            ovh_client = ovh.Client(
                endpoint=api_config.endpoint,
                application_key=api_config.appKey,
                application_secret=api_config.appSecret,
                consumer_key=api_config.consumerKey
            )
            add_log("info", "OVH客户端初始化成功")
        except Exception as e:
            add_log("error", f"初始化OVH客户端失败: {str(e)}")
            raise HTTPException(status_code=500, detail=f"初始化OVH客户端失败: {str(e)}")
    
    return ovh_client

# 发送Telegram消息
def send_telegram_msg(message: str):
    if not api_config:
        add_log("warning", "Telegram消息未发送: API配置不存在")
        return False
    
    # 检查Telegram配置是否完整
    if not api_config.tgToken:
        add_log("warning", "Telegram消息未发送: Bot Token未设置")
        return False
    
    if not api_config.tgChatId:
        add_log("warning", "Telegram消息未发送: Chat ID未设置")
        return False
    
    add_log("info", f"准备发送Telegram消息，ChatID: {api_config.tgChatId}, TokenLength: {len(api_config.tgToken)}")
    
    url = f"https://api.telegram.org/bot{api_config.tgToken}/sendMessage"
    payload = {
        "chat_id": api_config.tgChatId,
        "text": message
    }
    headers = {"Content-Type": "application/json"}

    try:
        add_log("info", f"发送HTTP请求到Telegram API: {url[:45]}...")
        response = requests.post(url, json=payload, headers=headers, timeout=10)
        add_log("info", f"Telegram API响应: 状态码={response.status_code}")
        
        if response.status_code == 200:
            try:
                response_data = response.json()
                add_log("info", f"Telegram响应数据: {response_data}")
                add_log("info", "成功发送消息到Telegram")
                return True
            except Exception as json_error:
                add_log("error", f"解析Telegram响应JSON时出错: {str(json_error)}")
        else:
            add_log("error", f"发送消息到Telegram失败: 状态码={response.status_code}, 响应={response.text}")
            return False
    except requests.exceptions.Timeout:
        add_log("error", "发送Telegram消息超时")
        return False
    except requests.exceptions.RequestException as e:
        add_log("error", f"发送Telegram消息时发生网络错误: {str(e)}")
        return False
    except Exception as e:
        add_log("error", f"发送Telegram消息时发生未预期错误: {str(e)}")
        add_log("error", f"错误详情: {traceback.format_exc()}")
        return False

# 获取服务器列表
async def fetch_product_catalog(subsidiary: str = 'IE'):
    try:
        response = requests.get(
            f"https://eu.api.ovh.com/v1/order/catalog/public/eco?ovhSubsidiary={subsidiary}",
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        add_log("error", f"获取产品目录失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"获取产品目录失败: {str(e)}")

# 检查服务器可用性
async def check_availability(planCode: str, options=None):
    client = get_ovh_client()
    
    try:
        # 添加详细日志记录
        add_log("info", f"正在请求服务器 {planCode} 的可用性信息，配置选项: {options}")
        
        # 基本查询参数
        query_params = {"planCode": planCode}
        
        # 如果提供了选项，将其添加到OVH API请求中
        if options and len(options) > 0:
            # 将options添加到查询参数
            add_log("info", f"使用配置选项检查可用性: {options}")
            for option in options:
                family = option.label  # 直接访问属性而不是使用get方法
                value = option.value   # 直接访问属性而不是使用get方法
                if family and value:
                    # 添加到查询参数
                    query_params[f"option.{family}"] = value
        
        # 使用构建好的查询参数调用API
        response = client.get('/dedicated/server/datacenter/availabilities', **query_params)
        
        # 记录完整响应的关键信息
        response_summary = f"响应类型: {type(response)}, 是否为列表: {isinstance(response, list)}, "
        if isinstance(response, list):
            response_summary += f"列表长度: {len(response)}"
            if len(response) > 0:
                first_item = response[0]
                response_summary += f", 第一项类型: {type(first_item)}"
                if isinstance(first_item, dict):
                    response_summary += f", 第一项键: {', '.join(first_item.keys())}"
        
        add_log("info", f"服务器 {planCode} 可用性API响应: {response_summary}")
        
        # 如果有数据中心信息，记录每个数据中心的状态
        if response and isinstance(response, list):
            if not response:
                add_log("warning", f"服务器 {planCode} 返回了空列表，没有可用性信息")
            else:
                add_log("info", f"获取到 {len(response)} 个可用性记录")
                
                for i, item in enumerate(response):
                    if isinstance(item, dict):
                        fqn = item.get("fqn", "未知")
                        datacenters = item.get("datacenters", [])
                        add_log("info", f"记录 #{i+1}: 服务器型号={fqn}, 包含 {len(datacenters)} 个数据中心")
                        
                        # 列出所有数据中心状态
                        if datacenters:
                            for j, dc in enumerate(datacenters):
                                dc_name = dc.get("datacenter", "未知")
                                dc_avail = dc.get("availability", "未知")
                                add_log("info", f"  - 数据中心 #{j+1}: {dc_name}, 可用性: {dc_avail}")
                        else:
                            add_log("warning", f"记录 #{i+1} 没有数据中心信息")
                    else:
                        add_log("warning", f"记录 #{i+1} 不是字典格式: {type(item)}")
        
        return response
    except Exception as e:
        add_log("error", f"检查服务器 {planCode} 可用性失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"检查可用性失败: {str(e)}")

# 添加一个调试端点，返回可用性数据的详细信息
@app.get("/api/debug/availability/{plan_code}")
async def debug_availability(plan_code: str):
    try:
        result = await check_availability(plan_code)
        # 返回详细信息，包括数据结构和类型
        return {
            "status": "success",
            "plan_code": plan_code,
            "result_type": str(type(result)),
            "is_list": isinstance(result, list),
            "length": len(result) if isinstance(result, list) else 0,
            "raw_data": result
        }
    except Exception as e:
        return {
            "status": "error",
            "plan_code": plan_code,
            "error": str(e)
        }

# 添加广播订单失败的函数
async def broadcast_order_failed(order: OrderHistory):
    """广播订单失败消息"""
    try:
        await broadcast_message({
            "type": "order_failed",
            "data": order.dict()
        })
        add_log("info", f"订单失败消息已广播: {order.id}")
    except Exception as e:
        add_log("error", f"广播订单失败消息失败: {str(e)}")

# 订购服务器
async def order_server(task_id: str, config: ServerConfig):
    client = get_ovh_client()
    cart_id = None
    
    # 更新任务状态
    update_task_status(task_id, "running", "正在检查服务器可用性...")
    
    try:
        # 1. 检查可用性
        add_log("info", f"开始检查服务器 {config.planCode} 在 {config.datacenter} 的可用性")
        availabilities = await check_availability(config.planCode, config.options)
        
        # 添加详细日志 - 记录原始响应
        add_log("info", f"获取到 {len(availabilities) if availabilities else 0} 条服务器可用性记录")
        
        # 检查指定数据中心是否可用
        found_available = False
        available_dc = None
        fqn = None
        
        if not availabilities:
            add_log("error", f"未找到计划代码 {config.planCode} 的可用性信息")
            update_task_status(task_id, "error", f"未找到计划代码 {config.planCode} 的可用性信息")
            return
        
        # 添加详细的检查日志
        add_log("info", f"开始详细检查每个数据中心的可用性")
        
        # 创建一个函数来比较FQN和当前选择的配置
        def match_config_with_fqn(fqn, config):
            # 提取当前用户选择的配置
            memory_option = next((opt.value for opt in config.options if opt.label == 'memory'), None)
            storage_option = next((opt.value for opt in config.options if opt.label == 'storage'), None)
            bandwidth_option = next((opt.value for opt in config.options if opt.label == 'bandwidth'), None)
            
            # 提取FQN中的信息（通常是planCode.memory.storage格式）
            fqn_parts = fqn.split('.')
            
            # 基本匹配：检查planCode
            if not fqn.startswith(config.planCode):
                return False, "planCode不匹配"
                
            # 如果没有选择任何选项，则使用第一个可用的配置
            if not config.options or len(config.options) == 0:
                return True, "使用默认配置（无选项）"
                
            # 检查内存配置
            if memory_option and len(fqn_parts) > 1:
                # 检查FQN中是否包含内存配置
                if memory_option not in fqn:
                    return False, f"内存配置不匹配: 选择={memory_option}, FQN={fqn}"
                    
            # 检查存储配置
            if storage_option and len(fqn_parts) > 2:
                # 检查FQN中是否包含存储配置
                if storage_option not in fqn:
                    return False, f"存储配置不匹配: 选择={storage_option}, FQN={fqn}"
                    
            # 带宽配置通常不在FQN中，所以不检查
            
            # 如果所有检查都通过，则匹配成功
            return True, "配置完全匹配"
            
        # 首先尝试查找完全匹配的配置
        exact_match_items = []
        
        for item in availabilities:
            fqn = item.get("fqn")
            match_result, match_reason = match_config_with_fqn(fqn, config)
            
            if match_result:
                add_log("info", f"找到匹配的配置: {fqn}, 原因: {match_reason}")
                exact_match_items.append(item)
            else:
                add_log("info", f"跳过不匹配的配置: {fqn}, 原因: {match_reason}")
                
        # 如果找到了匹配的配置，则只在这些匹配项中查找可用的数据中心
        items_to_check = exact_match_items if exact_match_items else availabilities
        add_log("info", f"将在 {len(items_to_check)} 个匹配的配置中查找可用的数据中心")
        
        for item in items_to_check:
            fqn = item.get("fqn")
            datacenters = item.get("datacenters", [])
            
            add_log("info", f"服务器型号: {fqn}, 找到 {len(datacenters)} 个数据中心")
            
            # 记录所有数据中心状态
            dc_status_log = []
            for dc_info in datacenters:
                availability = dc_info.get("availability")
                datacenter_name = dc_info.get("datacenter")
                dc_status_log.append(f"{datacenter_name}: {availability}")
            
            add_log("info", f"数据中心状态: {', '.join(dc_status_log)}")
            
            # 具体检查目标数据中心
            for dc_info in datacenters:
                availability = dc_info.get("availability")
                datacenter_name = dc_info.get("datacenter")
                
                # 修改为大小写不敏感的比较
                if datacenter_name and config.datacenter and datacenter_name.upper() == config.datacenter.upper():
                    add_log("info", f"找到目标数据中心 {datacenter_name} (匹配 {config.datacenter}), 可用性状态: {availability}")
                    
                    # 改进可用性状态判断逻辑，处理OVH特殊状态
                    # OVH的可用性状态格式可能是"1H-high"这样的字符串，表示可用
                    if availability not in ["unavailable", "unknown", None]:
                        # 检查是否包含数字和H，这通常表示有货和时间信息
                        if isinstance(availability, str) and ("H" in availability or "h" in availability):
                            found_available = True
                            available_dc = datacenter_name  # 使用API返回的原始数据中心名称
                            add_log("info", f"数据中心 {available_dc} 的服务器 {fqn} 状态为: {availability}，判定为可用，准备下单")
                            break
                        else:
                            add_log("info", f"数据中心 {datacenter_name} 的服务器 {fqn} 状态为: {availability}，判定为有效但不确定可用性")
                            # 如果无法确定，也认为可用，尝试订购
                            found_available = True
                            available_dc = datacenter_name  # 使用API返回的原始数据中心名称
                            break
                    else:
                        add_log("info", f"数据中心 {datacenter_name} 的服务器 {fqn} 状态为: {availability}，判定为不可用")
            
            if found_available:
                # 记录成功找到的精确配置
                add_log("info", f"在数据中心 {available_dc} 找到匹配的配置 {fqn} 可用")
                break
        
        if not found_available:
            add_log("info", f"计划代码 {config.planCode} 在 {config.datacenter} 数据中心无可用服务器，稍后重试")
            update_task_status(
                task_id, 
                "pending", 
                f"计划代码 {config.planCode} 在 {config.datacenter} 数据中心当前无可用服务器"
            )
            return
            
        # 如果找到可用服务器，继续执行订购流程
        # 添加关键日志，帮助跟踪可用性和订单流程
        # 在创建订单前添加
        if found_available:
            add_log("info", f"在数据中心 {available_dc} 找到可用服务器 {config.planCode}，将使用API返回的原始数据中心名称 '{available_dc}' 下单")
            
            # 更新配置中的数据中心名称，使用API返回的原始名称
            config.datacenter = available_dc
            
            # 构建用户选择的配置信息字符串
            user_config_display = config.planCode
            if config.options and len(config.options) > 0:
                # 提取内存、存储和带宽配置
                memory_option = next((opt.value for opt in config.options if opt.label == 'memory'), None)
                storage_option = next((opt.value for opt in config.options if opt.label == 'storage'), None)
                bandwidth_option = next((opt.value for opt in config.options if opt.label == 'bandwidth'), None)
                
                # 构建配置显示字符串
                config_parts = []
                if memory_option:
                    config_parts.append(memory_option)
                if storage_option:
                    config_parts.append(storage_option)
                if bandwidth_option:
                    config_parts.append(bandwidth_option)
                
                if config_parts:
                    user_config_display = f"{config.planCode} ({'.'.join(config_parts)})"
            
            # 发送Telegram通知，使用用户选择的配置
            msg = f"{api_config.iam}: 在 {available_dc} 找到 {user_config_display} 可用"
            send_telegram_msg(msg)
        
        # 2. 创建购物车
        update_task_status(task_id, "running", f"正在创建购物车...")
        cart_result = client.post('/order/cart', ovhSubsidiary=api_config.zone)
        cart_id = cart_result["cartId"]
        add_log("info", f"购物车创建成功，ID: {cart_id}")
        
        # 3. 绑定购物车
        update_task_status(task_id, "running", f"正在绑定购物车...")
        client.post(f'/order/cart/{cart_id}/assign')
        add_log("info", "购物车绑定成功")
        
        # 4. 添加基础商品到购物车
        update_task_status(task_id, "running", f"正在添加商品到购物车...")
        item_payload = {
            "planCode": config.planCode,
            "pricingMode": "default",
            "duration": config.duration,
            "quantity": config.quantity
        }
        
        item_result = client.post(f'/order/cart/{cart_id}/eco', **item_payload)
        item_id = item_result["itemId"]
        add_log("info", f"商品添加成功，项目 ID: {item_id}")
        
        # 5. 获取必需的配置项
        update_task_status(task_id, "running", f"正在配置购物车项目...")
        required_config = client.get(f'/order/cart/{cart_id}/item/{item_id}/requiredConfiguration')
        
        # 准备配置字典
        configurations_to_set = {}
        region_value = None
        
        # 查找'region'配置项
        for conf in required_config:
            label = conf.get("label")
            if label == "region":
                allowed_values = conf.get("allowedValues")
                if allowed_values:
                    region_value = allowed_values[0]
                    configurations_to_set["region"] = region_value
        
        # 添加其他必需配置
        configurations_to_set["dedicated_datacenter"] = config.datacenter
        configurations_to_set["dedicated_os"] = config.os
        
        # 配置购物车中的商品
        for label, value in configurations_to_set.items():
            if value is None:
                add_log("warning", f"配置项 {label} 的值是 None，跳过设置")
                continue
            
            try:
                add_log("info", f"配置项目 {item_id}: 设置 {label} = {value}")
                client.post(
                    f'/order/cart/{cart_id}/item/{item_id}/configuration',
                    label=label,
                    value=str(value)
                )
            except Exception as config_error:
                add_log("error", f"配置 {label} = {value} 失败: {str(config_error)}")
                if label == "dedicated_datacenter":
                    update_task_status(task_id, "error", f"关键配置项 {label} 设置失败，中止购买")
                    raise Exception(f"关键配置项 {label} 设置失败")
        
        # 6. 添加附加选项
        if config.options and len(config.options) > 0:
            update_task_status(task_id, "running", f"正在添加附加选项...")
            # 记录所有要添加的选项
            options_log = [f"{opt.label}={opt.value}" for opt in config.options]
            add_log("info", f"将为服务器 {config.planCode} 添加以下选项: {', '.join(options_log)}")
            
            # 添加选项
            for option in config.options:
                try:
                    add_log("info", f"添加选项: {option.label} = {option.value}")
                    option_payload = {
                        "label": option.label,
                        "value": option.value
                    }
                    client.post(f'/order/cart/{cart_id}/item/{item_id}/configuration', **option_payload)
                except Exception as option_error:
                    add_log("error", f"添加选项 {option.label} 失败: {str(option_error)}")
                    # 记录错误但继续尝试添加其他选项
                    continue
        else:
            # 如果没有选项，使用默认配置
            add_log("info", f"服务器 {config.planCode} 将使用默认配置下单，不添加任何自定义选项")
        
        # 7. 检查购物车
        update_task_status(task_id, "running", f"正在准备结账...")
        cart_summary = client.get(f'/order/cart/{cart_id}')
        checkout_info = client.get(f'/order/cart/{cart_id}/checkout')
        
        # 8. 执行结账
        update_task_status(task_id, "running", f"正在执行结账...")
        checkout_payload = {
            "autoPayWithPreferredPaymentMethod": False,
            "waiveRetractationPeriod": True
        }
        
        checkout_result = client.post(f'/order/cart/{cart_id}/checkout', **checkout_payload)
        add_log("info", "结账请求已提交！")
        
        # 9. 更新任务状态和订单历史
        order_url = checkout_result.get("url", "N/A")
        order_id = checkout_result.get("orderId")
        
        # 使用安全转换函数处理字段
        order_id_str = safe_str(order_id, "N/A")
        order_url_str = safe_str(order_url, "N/A")
        
        # 保存订单历史
        now = datetime.now().isoformat()
        history_entry = OrderHistory(
            id=str(uuid.uuid4()),
            planCode=config.planCode,
            name=config.name,
            datacenter=config.datacenter,
            orderTime=now,
            status="success",
            orderId=order_id_str,
            orderUrl=order_url_str
        )
        # 使用新函数添加订单并持久化
        add_order(history_entry)
        
        # 更新任务状态
        update_task_status(task_id, "completed", f"订单 {order_id_str} 已成功创建")
        
        # 广播订单完成消息
        await broadcast_order_completed(history_entry)
        
        # 发送Telegram通知
        success_msg = f"{api_config.iam}: 订单 {order_id_str} 已成功创建并支付！\n服务器: {user_config_display}\n数据中心: {config.datacenter}\n订单链接: {order_url_str}"
        send_telegram_msg(success_msg)
        
        # 返回成功信息
        return history_entry
    
    except Exception as e:
        # 处理错误
        error_msg = f"订购服务器失败: {str(e)}"
        add_log("error", error_msg)
        
        # 更新任务状态
        update_task_status(task_id, "error", error_msg)
        
        # 保存失败的订单记录
        now = datetime.now().isoformat()
        
        # 如果有订单ID，确保它是字符串类型
        order_id = None
        order_url = None
        if 'checkout_result' in locals() and checkout_result:
            order_id = checkout_result.get("orderId")
            order_url = checkout_result.get("url")
        
        # 创建失败订单记录
        history_entry = OrderHistory(
            id=str(uuid.uuid4()),
            planCode=config.planCode,
            name=config.name,
            datacenter=config.datacenter,
            orderTime=now,
            status="failed",
            orderId=safe_str(order_id),
            orderUrl=safe_str(order_url),
            error=error_msg
        )
        # 使用新函数添加订单并持久化
        add_order(history_entry)
        
        # 广播订单失败消息
        await broadcast_order_failed(history_entry)
        
        # 发送Telegram通知
        error_tg_msg = f"{api_config.iam}: OVH 操作失败 - {str(e)}"
        if cart_id:
            error_tg_msg += f"\nCart ID: {cart_id}"
        send_telegram_msg(error_tg_msg)
        
        # 返回错误信息
        return history_entry

# 增强任务状态更新函数
def update_task_status(task_id: str, status: str, message: Optional[str] = None):
    if task_id in tasks:
        task = tasks[task_id]
        old_status = task.status
        current_time = datetime.now().isoformat()
        
        # 更新任务状态
        task.status = status
        task.lastChecked = current_time
        
        if message:
            task.message = message
        
        if status == "pending":
            # 计算下次重试时间
            interval = task.taskInterval if hasattr(task, 'taskInterval') and task.taskInterval else settings.TASK_INTERVAL
            # 记录实际使用的间隔时间，便于调试
            add_log("debug", f"任务 {task_id} 使用重试间隔: {interval} 秒")
            next_retry = datetime.now().timestamp() + interval
            next_retry_time = datetime.fromtimestamp(next_retry).isoformat()
            task.nextRetryAt = next_retry_time
            
            add_log("info", f"任务 {task_id} ({task.name}) 状态由 {old_status} 变更为 {status}，下次检查时间: {next_retry_time}，消息: {message}")
        else:
            add_log("info", f"任务 {task_id} ({task.name}) 状态由 {old_status} 变更为 {status}，消息: {message}")
        
        # 广播任务状态更新
        asyncio.create_task(broadcast_message({
            "type": "task_updated",
            "data": task.dict()
        }))
        
        # 保存任务到文件，确保持久化
        save_tasks_to_file()

# 增强任务执行循环的日志
async def task_execution_loop():
    while True:
        now = datetime.now().timestamp()
        
        # 检查所有待处理任务
        for task_id, task in list(tasks.items()):
            if task.status not in ["pending", "error"]:
                continue
            
            # 如果达到最大重试次数，跳过
            if task.maxRetries > 0 and task.retryCount >= task.maxRetries:  # 只有当maxRetries > 0时才检查是否达到上限
                if task.status != "error":
                    add_log("info", f"任务 {task_id} ({task.name}) 达到最大重试次数 ({task.maxRetries})，停止重试")
                    update_task_status(task_id, "error", f"达到最大重试次数 ({task.maxRetries})")
                continue
            
            # 检查是否到达下次重试时间
            next_retry_time = datetime.fromisoformat(task.nextRetryAt) if task.nextRetryAt else datetime.now()
            time_until_retry = next_retry_time.timestamp() - now
            
            if now < next_retry_time.timestamp():
                # 只在调试时记录等待状态的日志，避免日志过多
                if task.retryCount > 0 and time_until_retry < 60:  # 仅当倒计时小于60秒时记录日志
                    add_log("debug", f"任务 {task_id} ({task.name}) 将在 {int(time_until_retry)} 秒后进行第 {task.retryCount + 1} 次尝试")
                continue
            
            # 增加重试计数
            task.retryCount += 1
            if task.maxRetries <= 0:
                add_log("info", f"开始第 {task.retryCount} 次尝试任务 {task_id} ({task.name})（无限重试模式），间隔时间为 {task.taskInterval} 秒")
            else:
                add_log("info", f"开始第 {task.retryCount}/{task.maxRetries} 次尝试任务 {task_id} ({task.name})，间隔时间为 {task.taskInterval} 秒")
            
            # 创建服务器配置
            server_config = ServerConfig(
                planCode=task.planCode,
                datacenter=task.datacenter,
                name=task.name,
                maxRetries=task.maxRetries,
                taskInterval=task.taskInterval,
                options=task.options  # 恢复选项信息
            )
            
            # 执行订购
            try:
                # 不等待完成，让它在后台运行
                asyncio.create_task(order_server(task_id, server_config))
            except Exception as e:
                add_log("error", f"启动任务 {task_id} 失败: {str(e)}")
                update_task_status(task_id, "error", f"启动任务失败: {str(e)}")
        
        # 等待下一个检查周期
        await asyncio.sleep(5)  # 每5秒检查一次任务状态

# API路由
@app.get("/")
async def root():
    return {"message": "OVH Titan Sniper API 正在运行"}

@app.get("/api/config")
async def get_api_config():
    if not api_config:
        return JSONResponse(status_code=404, content={"detail": "API配置未设置"})
    
    # 返回配置但隐藏敏感信息
    safe_config = api_config.dict()
    safe_config["appKey"] = "******" if safe_config["appKey"] else ""
    safe_config["appSecret"] = "******" if safe_config["appSecret"] else ""
    safe_config["consumerKey"] = "******" if safe_config["consumerKey"] else ""
    safe_config["tgToken"] = "******" if safe_config["tgToken"] else ""
    
    return safe_config

@app.post("/api/config")
async def set_api_config(config: ApiConfig):
    global api_config, ovh_client
    
    # 添加详细日志记录
    add_log("info", f"开始保存API配置，接收到的内容:")
    # 记录敏感信息的掩码版本
    safe_log = config.dict()
    if safe_log.get("appKey"):
        safe_log["appKey"] = "***" + safe_log["appKey"][-4:] if len(safe_log["appKey"]) > 4 else "***"
    if safe_log.get("appSecret"):
        safe_log["appSecret"] = "***" + safe_log["appSecret"][-4:] if len(safe_log["appSecret"]) > 4 else "***"
    if safe_log.get("consumerKey"):
        safe_log["consumerKey"] = "***" + safe_log["consumerKey"][-4:] if len(safe_log["consumerKey"]) > 4 else "***"
    if safe_log.get("tgToken"):
        safe_log["tgToken"] = "***" + safe_log["tgToken"][-4:] if len(safe_log["tgToken"]) > 4 else "***"
    
    # 记录Telegram配置项
    add_log("info", f"Telegram配置: tgChatId={safe_log.get('tgChatId')}, tgToken={'已设置' if safe_log.get('tgToken') else '未设置'}")
    add_log("info", f"API配置: {safe_log}")
    
    # 保存配置
    api_config = config
    ovh_client = None  # 重置客户端，下次会重新初始化
    
    # 保存配置到文件前记录日志
    add_log("info", "开始将配置保存到文件...")
    save_config_to_file()
    
    # 尝试发送测试消息到Telegram
    if config.tgToken and config.tgChatId:
        test_result = send_telegram_msg("OVH Titan Sniper: Telegram通知已成功配置")
        if test_result:
            add_log("info", "Telegram测试消息发送成功")
        else:
            add_log("warning", "Telegram测试消息发送失败，请检查Token和ChatID")
    
    add_log("info", "API配置已更新")
    return {"message": "API配置已更新"}

@app.get("/api/servers")
async def get_servers(subsidiary: str = 'IE'):
    catalog = await fetch_product_catalog(subsidiary)
    return catalog

@app.get("/api/servers/{plan_code}/availability")
async def get_server_availability(plan_code: str, request: Request):
    try:
        add_log("info", f"GET请求获取服务器 {plan_code} 的可用性数据")
        
        # 尝试从请求体中获取选项数据
        options = None
        try:
            body = await request.json()
            options = body.get("options", [])
            add_log("info", f"从GET请求体中解析出选项: {options}")
        except:
            # 如果无法解析请求体，则使用默认空选项
            add_log("info", f"GET请求没有提供选项或无法解析请求体，使用默认配置")
        
        # 调用检查可用性函数并传递选项
        result = await check_availability(plan_code, options)
        return result
    except Exception as e:
        add_log("error", f"获取服务器 {plan_code} 可用性数据时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/servers/{plan_code}/availability")
async def post_server_availability(plan_code: str, data: dict):
    try:
        add_log("info", f"POST请求获取服务器 {plan_code} 的可用性数据，请求体: {data}")
        
        # 从请求体中获取选项
        options = data.get("options", [])
        add_log("info", f"从请求体中解析出选项: {options}")
        
        # 调用原有的检查可用性函数
        result = await check_availability(plan_code, options)
        return result
    except Exception as e:
        add_log("error", f"POST获取服务器 {plan_code} 可用性数据时出错: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tasks")
async def get_tasks():
    return list(tasks.values())

@app.post("/api/tasks")
async def create_task(config: ServerConfig):
    task_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    next_check = datetime.fromtimestamp(datetime.now().timestamp() + 5).isoformat()
    
    # 标准化数据中心名称，确保它与API返回的格式匹配
    datacenter = config.datacenter.strip()
    
    new_task = TaskStatus(
        id=task_id,
        name=config.name,
        planCode=config.planCode,
        datacenter=datacenter,  # 使用标准化的数据中心名称
        status="pending",
        createdAt=now,
        lastChecked=now,  # 设置初始lastChecked值为当前时间
        maxRetries=config.maxRetries,
        nextRetryAt=next_check,
        message="任务已创建，等待执行",
        taskInterval=config.taskInterval if config.taskInterval else 60,
        options=config.options  # 保存选项信息
    )
    
    # 先保存任务
    tasks[task_id] = new_task
    add_log("info", f"创建了新任务: {config.name} ({task_id}), 数据中心: {datacenter}, 重试间隔: {new_task.taskInterval}秒, 最大重试次数: {new_task.maxRetries}, 配置选项: {len(new_task.options)}个")
    
    # 保存任务到文件，确保持久化
    save_tasks_to_file()
    
    # 确保广播消息成功发送
    try:
        # 直接广播，不使用asyncio.create_task以确保消息在响应前发送
        await broadcast_message({
            "type": "task_created",
            "data": new_task.dict()
        })
    except Exception as e:
        add_log("error", f"广播任务创建消息失败: {str(e)}")
        # 即使广播失败，也不影响任务创建
    
    return new_task

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    
    task_name = tasks[task_id].name
    del tasks[task_id]
    add_log("info", f"删除了任务: {task_name} ({task_id})")
    
    # 保存任务到文件，确保持久化
    save_tasks_to_file()
    
    # 广播任务删除消息
    await broadcast_message({
        "type": "task_deleted",
        "data": {"id": task_id}
    })
    
    return {"message": f"任务 {task_id} 已删除"}

@app.post("/api/tasks/{task_id}/retry")
async def retry_task(task_id: str):
    """重置错误状态的任务，使其重新尝试"""
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail=f"任务 {task_id} 不存在")
    
    task = tasks[task_id]
    
    # 如果是错误状态，重置为等待状态
    if task.status == "error":
        # 重置重试计数(可选,取决于需求)
        # task.retryCount = 0
        
        # 更新任务状态
        update_task_status(task_id, "pending", "任务已手动重置，将重新尝试")
        add_log("info", f"任务 {task_id} ({task.name}) 已被手动重置为等待状态")
        
        return {"message": f"任务 {task_id} 已重置为等待状态"}
    else:
        # 如果不是错误状态，返回相应的消息
        return {"message": f"任务 {task_id} 当前状态为 {task.status}，无需重置"}

@app.delete("/api/tasks")
async def clear_tasks():
    global tasks
    tasks_count = len(tasks)
    tasks = {}
    save_tasks_to_file()
    add_log("info", f"已清除 {tasks_count} 个任务")
    
    # 广播所有任务已清除
    await broadcast_message({
        "type": "tasks_cleared",
        "data": {"count": tasks_count}
    })
    
    return {"message": f"已清除 {tasks_count} 个任务"}

@app.get("/api/orders")
async def get_orders():
    return orders

@app.delete("/api/orders/{order_id}")
async def delete_order(order_id: str):
    global orders
    # 查找订单
    for i, order in enumerate(orders):
        if order.id == order_id:
            # 删除订单
            removed_order = orders.pop(i)
            save_orders_to_file()
            add_log("info", f"已删除订单: {order_id}")
            return {"message": f"已删除订单: {order_id}"}
    
    # 如果没有找到订单，返回404
    raise HTTPException(status_code=404, detail=f"未找到订单: {order_id}")

@app.delete("/api/orders")
async def clear_orders():
    global orders
    orders_count = len(orders)
    orders = []
    save_orders_to_file()
    add_log("info", f"已清除 {orders_count} 条订单历史记录")
    return {"message": f"已清除 {orders_count} 条订单历史记录"}

@app.get("/api/logs")
async def get_logs(limit: int = 100):
    return logs[-limit:] if limit < len(logs) else logs

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connections.append(websocket)
    connection_id = len(connections)  # 简单的连接ID
    add_log("info", f"新的WebSocket连接已建立 (ID: {connection_id}, 总连接数: {len(connections)})")
    
    try:
        # 准备安全的API配置（隐藏敏感信息）
        safe_config = None
        if api_config:
            safe_config = api_config.dict()
            # 隐藏敏感字段
            if safe_config.get("appKey"):
                safe_config["appKey"] = "******"
            if safe_config.get("appSecret"):
                safe_config["appSecret"] = "******" 
            if safe_config.get("consumerKey"):
                safe_config["consumerKey"] = "******"
            if safe_config.get("tgToken"):
                safe_config["tgToken"] = "******"
        
        # 发送初始数据，包含API配置状态和所有订单
        await websocket.send_json({
            "type": "initial_data",
            "data": {
                "tasks": [task.dict() for task in tasks.values()],
                "orders": [order.dict() for order in orders],  # 确保包含所有订单
                "logs": logs[-100:],
                "api_config": safe_config,  # 发送安全版本的API配置
                "connection_status": {
                    "is_connected": True,
                    "connection_id": connection_id,
                    "total_connections": len(connections),
                    "server_time": datetime.now().isoformat()
                }
            }
        })
        add_log("info", f"已向客户端 {connection_id} 发送初始数据: {len(tasks)} 个任务, {len(orders)} 个订单, {min(len(logs), 100)} 条日志")
        
        # 立即广播连接状态通知所有客户端
        await broadcast_message({
            "type": "connection_status",
            "data": {
                "is_connected": True,
                "active_connections": len(connections),
                "timestamp": datetime.now().isoformat()
            }
        })
        
        while True:
            # 检测连接健康状态
            if websocket.client_state != 1:  # 如果不是CONNECTED状态
                add_log("warning", f"客户端 {connection_id} 连接状态异常，关闭WebSocket")
                break
                
            # 保持连接，接收客户端的消息
            try:
                data = await websocket.receive_text()
                
                # 处理客户端消息
                try:
                    message = json.loads(data)
                    if isinstance(message, dict) and "type" in message:
                        # 处理心跳消息
                        if message["type"] == "ping":
                            await websocket.send_json({
                                "type": "pong",
                                "data": {
                                    "timestamp": datetime.now().isoformat(),
                                    "is_connected": True,
                                    "connection_id": connection_id
                                }
                            })
                        # 处理状态检查请求
                        elif message["type"] == "check_connection":
                            await websocket.send_json({
                                "type": "connection_status",
                                "data": {
                                    "is_connected": True,
                                    "active_connections": len(connections),
                                    "connection_id": connection_id,
                                    "timestamp": datetime.now().isoformat()
                                }
                            })
                            add_log("debug", f"客户端 {connection_id} 请求检查连接状态")
                except json.JSONDecodeError:
                    add_log("warning", f"收到无效的WebSocket消息 (客户端 {connection_id})")
                except Exception as e:
                    add_log("error", f"处理WebSocket消息时出错 (客户端 {connection_id}): {str(e)}")
            except WebSocketDisconnect:
                add_log("info", f"WebSocket接收消息时连接断开 (客户端 {connection_id})")
                break
            except Exception as e:
                add_log("error", f"WebSocket接收消息时发生错误 (客户端 {connection_id}): {str(e)}")
                break
    except WebSocketDisconnect:
        add_log("info", f"WebSocket连接已关闭 (客户端 {connection_id})")
    except Exception as e:
        add_log("error", f"WebSocket错误 (客户端 {connection_id}): {str(e)}")
    finally:
        # 确保连接被移除
        if websocket in connections:
            connections.remove(websocket)
            add_log("info", f"连接已移除 (客户端 {connection_id}), 剩余连接数: {len(connections)}")
            
            # 广播连接状态更新，告知所有客户端连接数变化
            try:
                await broadcast_message({
                    "type": "connection_status",
                    "data": {
                        "is_connected": True,
                        "active_connections": len(connections),
                        "timestamp": datetime.now().isoformat(),
                        "client_disconnected": connection_id
                    }
                })
            except Exception as e:
                add_log("error", f"断开连接后广播状态更新失败: {str(e)}")

# 添加安全的类型转换辅助函数
def safe_str(value, default=""):
    """安全地将值转换为字符串"""
    if value is None:
        return default
    return str(value)

# 修复广播订单完成消息的函数
async def broadcast_order_completed(order: OrderHistory):
    """广播订单完成消息"""
    try:
        await broadcast_message({
            "type": "order_completed",
            "data": order.dict()
        })
        add_log("info", f"订单完成消息已广播: {order.orderId}")
    except Exception as e:
        add_log("error", f"广播订单完成消息失败: {str(e)}")

# 添加连接状态检查API端点
@app.get("/api/connection/status")
async def get_connection_status():
    """获取当前连接状态的API端点"""
    return {
        "status": "connected",
        "active_connections": len(connections),
        "timestamp": datetime.now().isoformat()
    }

# 添加应用状态信息API端点
@app.get("/api/status")
async def get_application_status():
    """获取应用程序状态信息"""
    return {
        "status": "running",
        "active_connections": len(connections),
        "tasks_count": len(tasks),
        "orders_count": len(orders),
        "logs_count": len(logs),
        "server_time": datetime.now().isoformat(),
        "uptime": get_uptime()
    }

# 添加获取应用运行时间的函数
start_time = datetime.now()
def get_uptime():
    """获取应用的运行时间（秒）"""
    uptime = (datetime.now() - start_time).total_seconds()
    return int(uptime)

@app.post("/api/config/ovh")
async def set_ovh_api_config(config: dict):
    """仅更新OVH API相关的配置"""
    global api_config, ovh_client
    
    # 如果尚未初始化，则创建一个空配置
    if not api_config:
        api_config = ApiConfig(appKey="", appSecret="", consumerKey="")
    
    # 记录日志（屏蔽敏感信息）
    safe_log = config.copy()
    for key in ["appKey", "appSecret", "consumerKey"]:
        if key in safe_log and safe_log[key]:
            safe_log[key] = "***" + safe_log[key][-4:] if len(safe_log[key]) > 4 else "***"
    
    add_log("info", f"更新OVH API配置: {safe_log}")
    
    # 仅更新API相关的配置部分
    api_config.update_api_part(config)
    ovh_client = None  # 重置客户端，下次会重新初始化
    
    # 保存配置到文件
    save_config_to_file()
    
    add_log("info", "OVH API配置已更新")
    return {"message": "OVH API配置已更新"}

@app.post("/api/config/telegram")
async def set_telegram_config(config: dict):
    """仅更新Telegram通知相关的配置"""
    global api_config
    
    # 如果尚未初始化，则创建一个空配置
    if not api_config:
        api_config = ApiConfig(appKey="", appSecret="", consumerKey="")
    
    # 记录日志（屏蔽敏感信息）
    safe_log = config.copy()
    if "tgToken" in safe_log and safe_log["tgToken"]:
        safe_log["tgToken"] = "***" + safe_log["tgToken"][-4:] if len(safe_log["tgToken"]) > 4 else "***"
    
    add_log("info", f"更新Telegram通知配置: tgChatId={safe_log.get('tgChatId')}, tgToken={'已设置' if safe_log.get('tgToken') else '未设置'}")
    
    # 仅更新Telegram相关的配置部分
    api_config.update_telegram_part(config)
    
    # 保存配置到文件
    save_config_to_file()
    
    # 尝试发送测试消息到Telegram
    if api_config.tgToken and api_config.tgChatId:
        test_result = send_telegram_msg("OVH Titan Sniper: Telegram通知已成功配置")
        if test_result:
            add_log("info", "Telegram测试消息发送成功")
        else:
            add_log("warning", "Telegram测试消息发送失败，请检查Token和ChatID")
    
    add_log("info", "Telegram通知配置已更新")
    return {"message": "Telegram通知配置已更新"}

# 添加一个新的端点，用于直接使用默认配置下单
@app.post("/api/queue/new")
async def create_default_task(data: dict):
    """
    创建一个不带任何可选配置的任务
    请求体格式:
    {
        "name": "KS-A | Intel i7-6700k",  # 服务器名称
        "planCode": "24ska01",            # 服务器型号代码
        "datacenter": "gra"               # 数据中心
    }
    """
    try:
        # 从请求体中提取基本信息
        name = data.get("name")
        plan_code = data.get("planCode")
        datacenter = data.get("datacenter")
        
        # 验证必要参数
        if not all([name, plan_code, datacenter]):
            raise HTTPException(status_code=400, detail="缺少必要参数: name, planCode, datacenter")
        
        # 创建服务器配置对象，不包含任何可选参数
        config = ServerConfig(
            planCode=plan_code,
            datacenter=datacenter,
            name=name,
            maxRetries=-1,  # 无限重试
            taskInterval=60,  # 默认60秒
            options=[]  # 空列表，不传递任何配置选项
        )
        
        # 记录日志
        add_log("info", f"使用默认配置创建任务: {name} (型号: {plan_code}, 数据中心: {datacenter})")
        
        # 调用现有的创建任务函数
        new_task = await create_task(config)
        
        return {
            "status": "success",
            "message": f"已使用默认配置创建任务: {name}",
            "task_id": new_task.id
        }
        
    except Exception as e:
        add_log("error", f"创建默认配置任务失败: {str(e)}")
        raise HTTPException(status_code=500, detail=f"创建任务失败: {str(e)}")

# 运行服务器
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
