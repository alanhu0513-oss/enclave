FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p uploads/temp uploads/faces uploads/voices uploads/signatures uploads/pdfs data
EXPOSE 4000
CMD ["node", "src/index.js"]
