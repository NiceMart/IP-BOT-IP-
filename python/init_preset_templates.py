#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
初始化预设封面模板到数据库
"""

import json
import sqlite3
import os
import sys
from datetime import datetime

def get_db_path():
    """获取数据库路径"""
    # 假设数据库在项目根目录的data文件夹
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db_path = os.path.join(project_root, 'data', 'aigcpanel.db')
    return db_path

def init_templates():
    """初始化预设模板"""
    # 读取模板配置
    script_dir = os.path.dirname(os.path.abspath(__file__))
    template_file = os.path.join(script_dir, 'preset_templates.json')
    
    print(f"Reading templates from: {template_file}")
    
    with open(template_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    templates = data['templates']
    print(f"Found {len(templates)} preset templates")
    
    # 连接数据库
    db_path = get_db_path()
    print(f"Connecting to database: {db_path}")
    
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}")
        print("Please ensure the application has been run at least once to create the database.")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 检查表是否存在
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='cover_templates'
    """)
    
    if not cursor.fetchone():
        print("Error: cover_templates table does not exist")
        print("Please run the application first to create the database schema.")
        conn.close()
        return False
    
    # 清空现有预设模板（可选）
    print("Clearing existing preset templates...")
    cursor.execute("DELETE FROM cover_templates WHERE id LIKE 'preset-%'")
    
    # 插入预设模板
    now = int(datetime.now().timestamp() * 1000)
    
    for idx, template in enumerate(templates, 1):
        template_id = f"preset-{idx:02d}"
        name = template['name']
        config_json = json.dumps(template['config'], ensure_ascii=False)
        
        print(f"Inserting template: {name} (ID: {template_id})")
        
        cursor.execute("""
            INSERT INTO cover_templates 
            (id, name, config, thumbnail_path, created_at, updated_at)
            VALUES (?, ?, ?, NULL, ?, ?)
        """, (template_id, name, config_json, now, now))
    
    conn.commit()
    conn.close()
    
    print(f"\n✅ Successfully initialized {len(templates)} preset templates!")
    return True

def main():
    print("="*60)
    print("Preset Cover Templates Initialization")
    print("="*60)
    print()
    
    try:
        success = init_templates()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()