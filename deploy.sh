#!/bin/bash
# deploy.sh — Automated deployment for cross-review-mcp
# Usage: ./deploy.sh <version> [--skip-deploy] [--force]
# Example: ./deploy.sh 0.6.2
#          ./deploy.sh 0.6.2 --skip-deploy (build & git only)
#          ./deploy.sh 0.6.2 --force (re-tag existing version)

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_HOST="192.168.1.120"
REMOTE_USER="keijo"
REMOTE_PATH="/home/keijo/LLMAPI"
SERVICE_NAME="llmapi"
SSH_KEY="$HOME/.ssh/id_ed25519"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Parse arguments
NEW_VERSION="${1:-}"
SKIP_DEPLOY="${2:-}"
FORCE_TAG=false

if [[ "$SKIP_DEPLOY" == "--force" ]] || [[ "$SKIP_DEPLOY" == "-f" ]]; then
    FORCE_TAG=true
    SKIP_DEPLOY=""
fi

if [[ -z "$NEW_VERSION" ]]; then
    echo -e "${RED}❌ Error: Version required${NC}"
    echo "Usage: ./deploy.sh <version> [--skip-deploy] [--force]"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh 0.6.2              # Full deployment"
    echo "  ./deploy.sh 0.6.2 --skip-deploy # Build & git only"
    echo "  ./deploy.sh 0.6.2 --force       # Re-tag existing version"
    exit 1
fi

# Validate semantic versioning
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo -e "${RED}❌ Error: Invalid version format. Expected X.Y.Z (e.g., 0.6.2)${NC}"
    exit 1
fi

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  cross-review-mcp Automated Deployment${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Get current version
CURRENT_VERSION=$(grep '"version"' "$PROJECT_DIR/package.json" | head -1 | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
echo -e "${YELLOW}Current version:${NC} $CURRENT_VERSION"
echo -e "${YELLOW}New version:${NC} $NEW_VERSION"
echo ""

# Only update files if version is different
if [[ "$CURRENT_VERSION" != "$NEW_VERSION" ]]; then
    # Step 2: Update package.json
    echo -e "${BLUE}[1/8]${NC} Updating package.json..."
    sed -i '' "s/\"version\": \"$CURRENT_VERSION\"/\"version\": \"$NEW_VERSION\"/g" "$PROJECT_DIR/package.json"
    echo -e "${GREEN}✓ package.json updated${NC}"

    # Step 3: Update README.md
    echo -e "${BLUE}[2/8]${NC} Updating README.md..."
    sed -i '' "s/# cross-review-mcp v$CURRENT_VERSION/# cross-review-mcp v$NEW_VERSION/g" "$PROJECT_DIR/README.md"
    echo -e "${GREEN}✓ README.md updated${NC}"

    # Step 4: Update CHANGELOG.md
    echo -e "${BLUE}[3/8]${NC} Updating CHANGELOG.md..."
    DATE=$(date -u +"%Y-%m-%d")
    cat > /tmp/new_changelog_entry.txt << EOF
## [$NEW_VERSION] — $DATE

### Changed
- [Add your changes here]

### Fixed
- [Add your fixes here]

### Deployed
- Production endpoint: http://51.15.218.196:6280/mcp

EOF
    (cat /tmp/new_changelog_entry.txt; tail -n +2 "$PROJECT_DIR/CHANGELOG.md") > /tmp/changelog_temp.txt
    mv /tmp/changelog_temp.txt "$PROJECT_DIR/CHANGELOG.md"
    rm -f /tmp/new_changelog_entry.txt
    echo -e "${GREEN}✓ CHANGELOG.md updated (edit manually if needed)${NC}"
else
    echo -e "${YELLOW}[1-3/8]${NC} Version unchanged, skipping file updates"
fi

# Step 5: Build
echo -e "${BLUE}[4/8]${NC} Building TypeScript..."
cd "$PROJECT_DIR"
npm run build > /dev/null 2>&1
echo -e "${GREEN}✓ Build succeeded${NC}"

# Step 6: Git commit and tag
echo -e "${BLUE}[5/8]${NC} Committing to git..."
cd "$PROJECT_DIR"

# Only commit if there are changes
if [[ -n $(git status -s) ]]; then
    git add package.json README.md CHANGELOG.md src/ 2>/dev/null || true
    git commit -m "v$NEW_VERSION: Automated deployment

Updates version to $NEW_VERSION with latest changes.
See CHANGELOG.md for details."
fi

# Tag the release (force if --force flag)
if [[ "$FORCE_TAG" == "true" ]]; then
    git tag -f "v$NEW_VERSION"
    echo -e "${GREEN}✓ Tagged v$NEW_VERSION (forced)${NC}"
else
    if git tag "v$NEW_VERSION" 2>/dev/null; then
        echo -e "${GREEN}✓ Tagged v$NEW_VERSION${NC}"
    else
        echo -e "${YELLOW}⚠ Tag v$NEW_VERSION already exists (use --force to re-tag)${NC}"
    fi
fi

# Step 7: Push to GitHub
echo -e "${BLUE}[6/8]${NC} Pushing to GitHub..."
git push origin main 2>/dev/null || true
git push origin "v$NEW_VERSION" --force 2>/dev/null || git push origin "v$NEW_VERSION" 2>/dev/null || true
echo -e "${GREEN}✓ Pushed to GitHub${NC}"

# Step 8: Deploy to Linux (optional)
if [[ "$SKIP_DEPLOY" != "--skip-deploy" ]]; then
    echo -e "${BLUE}[7/8]${NC} Deploying to Linux..."
    rsync -avz -e "ssh -i $SSH_KEY" "$PROJECT_DIR/dist/" \
        "$REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH/dist/" \
        --delete > /dev/null 2>&1
    echo -e "${GREEN}✓ Synced dist/ to Linux${NC}"
    
    echo -e "${BLUE}[8/8]${NC} Restarting systemd service..."
    ssh -i "$SSH_KEY" "$REMOTE_USER@$REMOTE_HOST" \
        "systemctl restart $SERVICE_NAME && sleep 2 && systemctl status $SERVICE_NAME --no-pager | head -5" 
    
    # Health check
    echo ""
    echo -e "${YELLOW}Health check:${NC}"
    HEALTH=$(curl -s "http://$REMOTE_HOST:6280/health" 2>&1 | grep -o '"status":"ok"' || echo "failed")
    if [[ "$HEALTH" == '"status":"ok"' ]]; then
        echo -e "${GREEN}✓ Server is healthy${NC}"
    else
        echo -e "${RED}⚠ Health check may have issues${NC}"
    fi
else
    echo -e "${YELLOW}[7/8]${NC} Skipping Linux deployment (--skip-deploy flag)"
    echo -e "${YELLOW}[8/8]${NC} Skipping service restart"
fi

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ Deployment complete!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "Summary:"
echo "  Version: $NEW_VERSION"
echo "  Build: ✓ succeeded"
echo "  Git: ✓ committed and tagged"
echo "  GitHub: ✓ pushed"
if [[ "$SKIP_DEPLOY" != "--skip-deploy" ]]; then
    echo "  Linux: ✓ deployed and verified"
else
    echo "  Linux: (skipped)"
fi
echo ""
echo "Next steps:"
echo "  1. Edit CHANGELOG.md with actual changes"
echo "  2. Verify on GitHub: https://github.com/KEIJOT/cross-review-mcp/releases/tag/v$NEW_VERSION"
echo "  3. Test: curl http://$REMOTE_HOST:6280/health"
echo ""
