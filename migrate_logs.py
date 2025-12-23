#!/usr/bin/env python3
"""Migrate existing text logs to JSONL format for dashboard compatibility."""
import json
import os
import re
from datetime import datetime
import getpass
import socket

LOG_DIR = "/Users/chasedalton/CascadeProjects/windsurf-logger/logs"

def parse_conversation_log(filepath):
    """Parse the conversation.log file and return structured entries."""
    entries = []
    if not os.path.exists(filepath):
        return entries
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    blocks = content.split('=' * 80)
    
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        
        entry = {}
        lines = block.split('\n')
        content_started = False
        content_lines = []
        
        for line in lines:
            if line.startswith('Action:'):
                entry['action'] = line.replace('Action:', '').strip()
            elif line.startswith('Timestamp:'):
                entry['timestamp'] = line.replace('Timestamp:', '').strip()
            elif line.startswith('Trajectory ID:'):
                entry['trajectory_id'] = line.replace('Trajectory ID:', '').strip() or f"session_migrated_{datetime.now().strftime('%Y%m%d')}"
            elif line.startswith('User:'):
                user_host = line.replace('User:', '').strip()
                if '@' in user_host:
                    entry['user'], entry['hostname'] = user_host.split('@', 1)
                else:
                    entry['user'] = user_host
                    entry['hostname'] = socket.gethostname()
            elif line.startswith('Content:'):
                content_started = True
            elif content_started:
                content_lines.append(line)
        
        if content_lines:
            entry['content'] = '\n'.join(content_lines).strip()
        
        # Set defaults for old entries without user info
        if 'user' not in entry:
            entry['user'] = getpass.getuser()
        if 'hostname' not in entry:
            entry['hostname'] = socket.gethostname()
        
        # Determine type
        if entry.get('action') == 'pre_user_prompt':
            entry['type'] = 'prompt'
        elif entry.get('action') == 'post_cascade_response':
            entry['type'] = 'response'
            # Extract code blocks
            pattern = r'```(\w*)\n(.*?)```'
            matches = re.findall(pattern, entry.get('content', ''), re.DOTALL)
            entry['code_blocks'] = [{"language": lang or "text", "code": code.strip()} for lang, code in matches]
            entry['code_block_count'] = len(entry['code_blocks'])
        
        if entry.get('content'):
            entry['content_length'] = len(entry['content'])
            entry['id'] = f"{entry.get('action', 'unknown')}_{entry.get('timestamp', datetime.now().isoformat()).replace(':', '_').replace('.', '_')}"
            entries.append(entry)
    
    return entries

def main():
    print("🔄 Migrating existing logs to JSONL format...")
    
    conversation_log = os.path.join(LOG_DIR, "conversation.log")
    entries = parse_conversation_log(conversation_log)
    
    if not entries:
        print("❌ No entries found to migrate")
        return
    
    print(f"📊 Found {len(entries)} entries to migrate")
    
    # Write to consolidated.jsonl
    consolidated_path = os.path.join(LOG_DIR, "consolidated.jsonl")
    prompts_path = os.path.join(LOG_DIR, "prompts.jsonl")
    responses_path = os.path.join(LOG_DIR, "responses.jsonl")
    
    prompts = []
    responses = []
    
    for entry in entries:
        if entry.get('type') == 'prompt':
            prompts.append(entry)
        elif entry.get('type') == 'response':
            responses.append(entry)
    
    # Write files
    with open(consolidated_path, 'w') as f:
        for entry in entries:
            f.write(json.dumps(entry) + '\n')
    print(f"✅ Wrote {len(entries)} entries to consolidated.jsonl")
    
    with open(prompts_path, 'w') as f:
        for entry in prompts:
            f.write(json.dumps(entry) + '\n')
    print(f"✅ Wrote {len(prompts)} prompts to prompts.jsonl")
    
    with open(responses_path, 'w') as f:
        for entry in responses:
            f.write(json.dumps(entry) + '\n')
    print(f"✅ Wrote {len(responses)} responses to responses.jsonl")
    
    print("🎉 Migration complete!")

if __name__ == "__main__":
    main()
