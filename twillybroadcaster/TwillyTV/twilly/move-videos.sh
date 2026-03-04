#!/bin/bash

# Video SKs to move
videos=(
  "FILE#file-1757645308093-90byea0wh"
  "FILE#file-1757648087726-z4w54p2wc"
  "FILE#file-1757650484492-7g3k70bdn"
  "FILE#file-1757650739997-v0llsflkw"
  "FILE#file-1757650766501-txs9pd36y"
)

for sk in "${videos[@]}"; do
  echo "Moving video: $sk"
  
  # Get the video from personal account
  aws dynamodb get-item \
    --table-name Twilly \
    --key "{\"PK\": {\"S\": \"USER#dehsin365@gmail.com\"}, \"SK\": {\"S\": \"$sk\"}}" \
    --region us-east-1 > temp_video.json
  
  # Check if video exists
  if [ -s temp_video.json ] && grep -q "Item" temp_video.json; then
    echo "  ✅ Found video, moving to master account..."
    
    # Create new item for master account
    jq '.Item.PK = {"S": "USER#dehyu.sinyan@gmail.com"} | .Item.isCollaboratorVideo = {"BOOL": true} | .Item.streamerEmail = {"S": "dehsin365@gmail.com"}' temp_video.json > master_video.json
    
    # Put item in master account
    aws dynamodb put-item \
      --table-name Twilly \
      --item file://master_video.json \
      --region us-east-1
    
    if [ $? -eq 0 ]; then
      echo "  ✅ Moved to master account"
      
      # Delete from personal account
      aws dynamodb delete-item \
        --table-name Twilly \
        --key "{\"PK\": {\"S\": \"USER#dehsin365@gmail.com\"}, \"SK\": {\"S\": \"$sk\"}}" \
        --region us-east-1
      
      if [ $? -eq 0 ]; then
        echo "  ✅ Deleted from personal account"
      else
        echo "  ❌ Failed to delete from personal account"
      fi
    else
      echo "  ❌ Failed to move to master account"
    fi
  else
    echo "  ❌ Video not found"
  fi
  
  # Clean up temp files
  rm -f temp_video.json master_video.json
done

echo "✅ All videos processed!"
