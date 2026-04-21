FROM node:18-slim

# Install Python and PDF libraries
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip3 install reportlab markdown2

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .

CMD ["node", "bot.js"]
