FROM node:18-slim

# Install Python and font dependencies for PDF generation
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages (reportlab and markdown2)
RUN pip3 install reportlab markdown2 --break-system-packages

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# Expose port for Render
ENV PORT=10000
EXPOSE 10000

CMD ["node", "bot.js"]
