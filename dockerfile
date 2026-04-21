# Use a slim version of Node
FROM node:18-slim

# Install Python and Pip
RUN apt-get update && apt-get install -y python3 python3-pip

# Create app directory
WORKDIR /usr/src/app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy requirements and install Python dependencies
COPY requirements.txt ./
# THE FIX IS ON THE LINE BELOW:
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Copy the rest of your code
COPY . .

# Start the bot
CMD [ "node", "bot.js" ]
