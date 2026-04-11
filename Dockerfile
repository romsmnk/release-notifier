FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run db:migrate:deploy

RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
