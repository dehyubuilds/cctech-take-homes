#!/bin/bash

# Streaming Issues Diagnostic Script
# Run this on your EC2 server to identify current problems

echo "=== Twilly Streaming Diagnostics ==="
echo "Timestamp: $(date)"
echo ""

# 1. System Resources
echo "=== SYSTEM RESOURCES ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1
echo ""

echo "Memory Usage:"
free -h
echo ""

echo "Disk Usage:"
df -h
echo ""

# 2. Process Monitoring
echo "=== PROCESS MONITORING ==="
echo "FFmpeg Processes:"
ps aux | grep ffmpeg | grep -v grep
echo ""

echo "Node.js Processes:"
ps aux | grep node | grep -v grep
echo ""

echo "Stream Processing Processes:"
ps aux | grep -E "(stream|video|process)" | grep -v grep
echo ""

# 3. Network and Ports
echo "=== NETWORK STATUS ==="
echo "Active Connections:"
netstat -tuln | grep -E "(1935|8080|3000)"
echo ""

echo "RTMP Server Status:"
curl -s http://localhost:8080/status 2>/dev/null || echo "RTMP server not responding"
echo ""

# 4. Log Analysis
echo "=== LOG ANALYSIS ==="
echo "Recent Error Logs:"
tail -n 50 /var/log/syslog | grep -i error
echo ""

echo "Recent Stream Logs:"
find /var/log -name "*.log" -exec grep -l "stream\|ffmpeg" {} \; | head -5 | xargs tail -n 20 2>/dev/null
echo ""

# 5. File System Issues
echo "=== FILE SYSTEM ==="
echo "Inode Usage:"
df -i
echo ""

echo "Large Files in /tmp:"
find /tmp -type f -size +100M 2>/dev/null | head -10
echo ""

# 6. Memory Leaks Check
echo "=== MEMORY LEAK CHECK ==="
echo "Process Memory Usage:"
ps aux --sort=-%mem | head -10
echo ""

# 7. Thumbnail Generation Check
echo "=== THUMBNAIL STATUS ==="
echo "Recent Thumbnail Files:"
find /tmp -name "*thumb*" -mtime -1 2>/dev/null | head -10
echo ""

echo "Thumbnail Generation Errors:"
grep -r "thumbnail\|thumb" /var/log/ 2>/dev/null | tail -10
echo ""

# 8. Lambda Migration Readiness
echo "=== LAMBDA MIGRATION READINESS ==="
echo "Current Processing Queue:"
# Add your queue checking logic here
echo "Queue status: [Add your queue monitoring command]"
echo ""

echo "Stream Processing Time:"
# Add timing analysis here
echo "Average processing time: [Add your timing analysis]"
echo ""

# 9. Recommendations
echo "=== RECOMMENDATIONS ==="
echo "1. If memory usage > 80%: Consider Lambda migration for better resource management"
echo "2. If FFmpeg processes hanging: Lambda with automatic retries would be more reliable"
echo "3. If processing time > 10 minutes: Lambda parallel processing would reduce to 2-3 minutes"
echo "4. If thumbnail generation failing: Lambda with dedicated FFmpeg layer would be 99.9% reliable"
echo ""

echo "=== DIAGNOSTIC COMPLETE ===" 