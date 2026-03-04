#!/bin/bash

# Stream-to-Clip Manager for Twilly x AWS
# This script manages RTMP ingest, FFmpeg transcoding, and S3 sync

set -e

# Configuration
STREAMS_DIR="/var/www/html/streams"
S3_BUCKET="your-s3-bucket-name"
CLOUDFRONT_DOMAIN="your-cloudfront-domain.net"
EVENT_NAME="dark-knights"
RTMP_PORT="1935"
HLS_SEGMENT_TIME="4"
HLS_LIST_SIZE="0"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    mkdir -p "$STREAMS_DIR"
    mkdir -p "/tmp/streams"
    log "Directories created successfully"
}

# Generate session ID
generate_session_id() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local random_id=$(cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 8 | head -n 1)
    echo "${EVENT_NAME}_${timestamp}_${random_id}"
}

# Start a new stream session
start_stream() {
    local session_id=$(generate_session_id)
    local session_dir="$STREAMS_DIR/$session_id"
    
    log "Starting new stream session: $session_id"
    
    # Create session directory
    mkdir -p "$session_dir"
    
    # Start FFmpeg process for RTMP to HLS conversion
    start_ffmpeg "$session_id" "$session_dir" &
    local ffmpeg_pid=$!
    
    # Save session info
    echo "$session_id" > "$session_dir/session.info"
    echo "$ffmpeg_pid" > "$session_dir/ffmpeg.pid"
    echo "$(date +%s)" > "$session_dir/start_time"
    
    log "Stream session $session_id started with PID $ffmpeg_pid"
    log "RTMP Endpoint: rtmp://$(hostname -I | awk '{print $1}'):$RTMP_PORT/live/$session_id"
    log "HLS Endpoint: https://$CLOUDFRONT_DOMAIN/events/$session_id/playlist.m3u8"
    
    echo "$session_id"
}

# Start FFmpeg transcoding process
start_ffmpeg() {
    local session_id="$1"
    local session_dir="$2"
    
    log "Starting FFmpeg for session $session_id"
    
    ffmpeg -i "rtmp://localhost/live/$session_id" \
        -c:v libx264 -preset veryfast -crf 23 \
        -c:a aac -b:a 128k \
        -f hls \
        -hls_time $HLS_SEGMENT_TIME \
        -hls_list_size $HLS_LIST_SIZE \
        -hls_flags independent_segments+delete_segments \
        -hls_segment_filename "$session_dir/seg_%03d.ts" \
        -hls_playlist_type vod \
        "$session_dir/playlist.m3u8" \
        2> "$session_dir/ffmpeg.log"
}

# Stop a stream session
stop_stream() {
    local session_id="$1"
    local session_dir="$STREAMS_DIR/$session_id"
    
    if [ ! -d "$session_dir" ]; then
        error "Session directory not found: $session_dir"
        return 1
    fi
    
    log "Stopping stream session: $session_id"
    
    # Stop FFmpeg process
    if [ -f "$session_dir/ffmpeg.pid" ]; then
        local ffmpeg_pid=$(cat "$session_dir/ffmpeg.pid")
        if kill -0 "$ffmpeg_pid" 2>/dev/null; then
            kill "$ffmpeg_pid"
            log "FFmpeg process $ffmpeg_pid stopped"
        else
            warn "FFmpeg process $ffmpeg_pid not running"
        fi
    fi
    
    # Calculate duration
    if [ -f "$session_dir/start_time" ]; then
        local start_time=$(cat "$session_dir/start_time")
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        echo "$duration" > "$session_dir/duration"
        log "Stream duration: $duration seconds"
    fi
    
    # Sync to S3
    sync_to_s3 "$session_id"
    
    log "Stream session $session_id stopped successfully"
}

# Sync session to S3
sync_to_s3() {
    local session_id="$1"
    local session_dir="$STREAMS_DIR/$session_id"
    local s3_path="s3://$S3_BUCKET/events/$session_id"
    
    log "Syncing session $session_id to S3..."
    
    # Create metadata file
    cat > "$session_dir/metadata.json" << EOF
{
    "session_id": "$session_id",
    "event_name": "$EVENT_NAME",
    "created_at": "$(date -Iseconds)",
    "duration": "$(cat "$session_dir/duration" 2>/dev/null || echo '0')",
    "segments": $(ls "$session_dir"/*.ts 2>/dev/null | wc -l),
    "hls_url": "https://$CLOUDFRONT_DOMAIN/events/$session_id/playlist.m3u8"
}
EOF
    
    # Sync to S3
    aws s3 sync "$session_dir" "$s3_path" --delete
    
    log "Session $session_id synced to S3: $s3_path"
    log "Public URL: https://$CLOUDFRONT_DOMAIN/events/$session_id/playlist.m3u8"
}

# List active sessions
list_sessions() {
    log "Active stream sessions:"
    
    if [ ! -d "$STREAMS_DIR" ]; then
        warn "No streams directory found"
        return
    fi
    
    for session_dir in "$STREAMS_DIR"/*; do
        if [ -d "$session_dir" ]; then
            local session_id=$(basename "$session_dir")
            local session_info="$session_dir/session.info"
            local ffmpeg_pid="$session_dir/ffmpeg.pid"
            
            if [ -f "$ffmpeg_pid" ]; then
                local pid=$(cat "$ffmpeg_pid")
                if kill -0 "$pid" 2>/dev/null; then
                    echo -e "  ${GREEN}●${NC} $session_id (PID: $pid) - ACTIVE"
                else
                    echo -e "  ${RED}●${NC} $session_id (PID: $pid) - STOPPED"
                fi
            else
                echo -e "  ${YELLOW}●${NC} $session_id - NO PID FILE"
            fi
        fi
    done
}

# Clean up old sessions
cleanup_old_sessions() {
    local max_age_hours="${1:-24}"
    local cutoff_time=$(date -d "$max_age_hours hours ago" +%s)
    
    log "Cleaning up sessions older than $max_age_hours hours..."
    
    for session_dir in "$STREAMS_DIR"/*; do
        if [ -d "$session_dir" ]; then
            local session_id=$(basename "$session_dir")
            local start_time_file="$session_dir/start_time"
            
            if [ -f "$start_time_file" ]; then
                local start_time=$(cat "$start_time_file")
                if [ "$start_time" -lt "$cutoff_time" ]; then
                    log "Removing old session: $session_id"
                    rm -rf "$session_dir"
                fi
            fi
        fi
    done
    
    log "Cleanup completed"
}

# Monitor stream health
monitor_streams() {
    log "Monitoring active streams..."
    
    for session_dir in "$STREAMS_DIR"/*; do
        if [ -d "$session_dir" ]; then
            local session_id=$(basename "$session_dir")
            local ffmpeg_pid="$session_dir/ffmpeg.pid"
            
            if [ -f "$ffmpeg_pid" ]; then
                local pid=$(cat "$ffmpeg_pid")
                if ! kill -0 "$pid" 2>/dev/null; then
                    warn "FFmpeg process for session $session_id is not running"
                    # Optionally restart or mark as failed
                fi
            fi
        fi
    done
}

# Show usage
show_usage() {
    echo "Stream-to-Clip Manager for Twilly x AWS"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  start [session_id]    Start a new stream session (optional session_id)"
    echo "  stop <session_id>     Stop a stream session"
    echo "  list                  List all active sessions"
    echo "  sync <session_id>     Sync a session to S3"
    echo "  cleanup [hours]       Clean up old sessions (default: 24 hours)"
    echo "  monitor               Monitor stream health"
    echo "  setup                 Setup directories"
    echo "  help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 start"
    echo "  $0 stop dark-knights_20231201_143022_abc123"
    echo "  $0 list"
    echo "  $0 cleanup 48"
}

# Main script logic
main() {
    case "${1:-help}" in
        start)
            setup_directories
            start_stream
            ;;
        stop)
            if [ -z "$2" ]; then
                error "Session ID required for stop command"
                exit 1
            fi
            stop_stream "$2"
            ;;
        list)
            list_sessions
            ;;
        sync)
            if [ -z "$2" ]; then
                error "Session ID required for sync command"
                exit 1
            fi
            sync_to_s3 "$2"
            ;;
        cleanup)
            cleanup_old_sessions "$2"
            ;;
        monitor)
            monitor_streams
            ;;
        setup)
            setup_directories
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            error "Unknown command: $1"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@" 