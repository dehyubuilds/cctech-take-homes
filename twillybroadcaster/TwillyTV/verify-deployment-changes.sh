#!/bin/bash

# Verify that the recent changes are in the codebase
# This script checks that the fixes we made are present

echo "🔍 Verifying deployment changes..."
echo ""

# Check 1: request-follow.post.js has the improved username lookup
echo "1. Checking request-follow.post.js..."
if grep -q "Case-insensitive search for exact username match" "TwillyTV/twilly/server/api/users/request-follow.post.js"; then
    echo "   ✅ Improved username lookup found"
else
    echo "   ❌ Improved username lookup NOT found"
    exit 1
fi

# Check 2: get-content.post.js has enhanced logging
echo "2. Checking get-content.post.js..."
if grep -q "Added username to filter set" "TwillyTV/twilly/server/api/channels/get-content.post.js"; then
    echo "   ✅ Enhanced logging found"
else
    echo "   ❌ Enhanced logging NOT found"
    exit 1
fi

# Check 3: get-content.post.js has detailed filtering logs
if grep -q "itemUsername (lowercase)" "TwillyTV/twilly/server/api/channels/get-content.post.js"; then
    echo "   ✅ Detailed filtering logs found"
else
    echo "   ❌ Detailed filtering logs NOT found"
    exit 1
fi

echo ""
echo "✅ All changes verified in codebase!"
echo ""
echo "📝 Next steps:"
echo "   1. If using Git-based deployment (Netlify/Amplify): Changes should auto-deploy"
echo "   2. If manual deployment: Run 'npm run build' in TwillyTV/twilly/ and deploy"
echo "   3. Verify deployment by checking server logs when testing the add workflow"
