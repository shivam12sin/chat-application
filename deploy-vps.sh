#!/usr/bin/env bash
# ==============================================================================
# Aether VPS Deployment Script (Docker Compose + SSL + Scaling)
# Designed for Ubuntu / Debian Linux VPS Servers
# ==============================================================================

# Terminal Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Clear terminal and print banner
clear
echo -e "${CYAN}"
echo "======================================================================"
echo "    _    _____ _____ _   _ _____ ____    ____  _____ ____  _     _____   "
echo "   / \  | ____|_   _| | | | ____|  _ \  |  _ \| ____|  _ \| |   | ____|  "
echo "  / _ \ |  _|   | | | |_| |  _| | |_) | | | | |  _| | |_) | |   |  _|    "
echo " / ___ \| |___  | | |  _  | |___|  _ <  | |_| | |___|  __/| |___| |___   "
echo "/_/   \_\_____| |_| |_| |_|_____|_| \_\ |____/|_____|_|   |_____|_____|  "
echo "======================================================================"
echo -e "          High-Scale Clustered Chat Platform Deployment Tool         ${NC}"
echo ""

# Ensure the script is run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Please run this script as root (use: sudo bash deploy-vps.sh)${NC}"
  exit 1
fi

# 1. Host Package Verification
echo -e "${BLUE}[1/5] Verifying system dependencies on the host...${NC}"

# Update apt
apt-get update -y >/dev/null

# Install Git if missing
if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}Installing git...${NC}"
    apt-get install -y git >/dev/null
fi

# Install Docker if missing
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release >/dev/null
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y >/dev/null
    apt-get install -y docker-ce docker-ce-cli containerd.io >/dev/null
fi

# Install Docker Compose if missing
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    apt-get install -y docker-compose >/dev/null
fi

# Install Certbot if missing
if ! command -v certbot &> /dev/null; then
    echo -e "${YELLOW}Installing Certbot for Let's Encrypt SSL...${NC}"
    apt-get install -y certbot >/dev/null
fi

echo -e "${GREEN}✓ All host dependencies are installed.${NC}\n"

# 2. Gather Configuration
echo -e "${BLUE}[2/5] Production Configuration Setup...${NC}"
read -p "Enter your public domain name (e.g. aether.yourdomain.com): " DOMAIN_NAME
if [ -z "$DOMAIN_NAME" ]; then
    echo -e "${RED}❌ Domain name is required. Aborting.${NC}"
    exit 1
fi

read -p "Enter contact email address (for Let's Encrypt certificate notifications): " EMAIL_ADDRESS
if [ -z "$EMAIL_ADDRESS" ]; then
    echo -e "${RED}❌ Email address is required. Aborting.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Settings saved.${NC}\n"

# 3. Secure SSL/TLS Certificates (Let's Encrypt)
echo -e "${BLUE}[3/5] Requesting Let's Encrypt SSL/TLS Certificates for $DOMAIN_NAME...${NC}"

# Stop any local web servers on port 80 to free up standalone certbot binding
echo -e "${YELLOW}Temporarily stopping port 80/443 listeners if running...${NC}"
systemctl stop nginx 2>/dev/null
systemctl stop apache2 2>/dev/null
docker stop chat_nginx 2>/dev/null

# Request Cert
certbot certonly --standalone --non-interactive --agree-tos --email "$EMAIL_ADDRESS" -d "$DOMAIN_NAME"

if [ ! -d "/etc/letsencrypt/live/$DOMAIN_NAME" ]; then
    echo -e "${RED}❌ Certbot failed to generate SSL certificates. Please verify that your domain's A-record points to this server's public IP.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ SSL Certificates successfully generated!${NC}"

# Ensure nginx certs folder exists
mkdir -p nginx/certs

# Create symlinks or copy keys into our nginx certs folder
echo -e "${YELLOW}Linking SSL certificates to the Nginx container directory...${NC}"
cp "/etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem" nginx/certs/nginx.crt
cp "/etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem" nginx/certs/nginx.key

echo -e "${GREEN}✓ Nginx SSL configuration prepared.${NC}\n"

# 4. Generate Production Environment Variables (.env)
echo -e "${BLUE}[4/5] Preparing Production Environment Variables...${NC}"

# Copy .env.example if no .env exists
if [ ! -f "backend/.env" ]; then
    cp backend/.env.example backend/.env
fi

# Generate strong random JWT secret
RANDOM_JWT_SECRET=$(openssl rand -base64 32)

# Update backend/.env file variables
sed -i "s|NODE_ENV=.*|NODE_ENV=production|g" backend/.env
sed -i "s|CORS_ORIGIN=.*|CORS_ORIGIN=https://$DOMAIN_NAME|g" backend/.env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=$RANDOM_JWT_SECRET|g" backend/.env

# Update DB_HOST to postgres container inside docker network
sed -i "s|DB_HOST=.*|DB_HOST=postgres|g" backend/.env
sed -i "s|REDIS_HOST=.*|REDIS_HOST=redis|g" backend/.env

echo -e "${GREEN}✓ Production environment (.env) hardened and saved.${NC}\n"

# 5. Launch Scaled Container Cluster
echo -e "${BLUE}[5/5] Building and launching load-balanced Docker containers...${NC}"

# Shutdown any old instances
docker-compose down -v 2>/dev/null

# Start the cluster
docker-compose up -d --build --scale backend=4

echo -e "\n${GREEN}======================================================================"
echo -e "🎉 CONGRATULATIONS! AETHER CHAT PLATFORM IS ONLINE!"
echo -e "======================================================================"
echo -e "Your website is live at: ${CYAN}https://$DOMAIN_NAME${NC}"
echo -e "The Nginx Load Balancer is distributing WebSocket connections."
echo -e "Backend instances running: 4 nodes (horizontal scaling enabled)"
echo -e "SSL Certificates are auto-managed by Let's Encrypt."
echo -e "======================================================================${NC}\n"

# Setup automatic renewal cron job
(crontab -l 2>/dev/null; echo "0 0 * * * certbot renew --post-hook 'cp /etc/letsencrypt/live/$DOMAIN_NAME/fullchain.pem /var/www/aether/nginx/certs/nginx.crt && cp /etc/letsencrypt/live/$DOMAIN_NAME/privkey.pem /var/www/aether/nginx/certs/nginx.key && docker restart chat_nginx' > /dev/null 2>&1") | crontab -
echo -e "${YELLOW}Cron job scheduled for Let's Encrypt daily renewals.${NC}"
