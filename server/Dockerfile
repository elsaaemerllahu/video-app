FROM node:18

WORKDIR /app

# Copy both server and client
COPY . .

# Install server dependencies
WORKDIR /app/server
RUN npm install

# Build client
WORKDIR /app/client
RUN npm install
RUN npm run build

# Go back to server and run it
WORKDIR /app/server
EXPOSE 3000
CMD ["node", "server.js"]
