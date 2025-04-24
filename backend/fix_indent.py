with open('main.py', 'r', encoding='utf-8') as f:
    content = f.readlines()

# 修复788行缩进问题
content[787] = '    available_dc = None\n'

# 修复810-813行缩进问题
content[809] = '                        found_available = True\n'
content[810] = '                        available_dc = datacenter_name\n'
content[811] = '                        task_logger.info(f"在数据中心 {available_dc} 找到基础 planCode {config.planCode} 可用 (FQN 可能不同: {current_fqn})!")\n'
content[812] = '                        break\n'

# 修复825行缩进问题
content[824] = '        send_telegram_msg(msg)\n'

# 修复942行缩进问题和其他try-except语句的缩进问题
content[941] = '                            option_payload = {\n'

# 修复1036-1037行缩进问题
content[1035] = '        add_log("error", error_msg)\n'
content[1036] = '        task_logger.error(error_msg)\n'
content[1036] = '        update_task_status(task_id, "error", error_msg)\n'

# 修复1059行缩进问题
content[1058] = '            await broadcast_order_failed(history_entry)\n'
content[1061] = '            send_telegram_msg(error_tg_msg)\n'

# 修复1111行缩进问题
content[1110] = '            asyncio.create_task(broadcast_message({\n'

# 修复1120行缩进问题
content[1119] = '    else:\n'
content[1120] = '        add_log("warning", f"尝试更新不存在的任务状态: {task_id}")\n'

with open('main.py', 'w', encoding='utf-8') as f:
    f.writelines(content)

print('已修复所有缩进问题，请再次尝试运行程序') 