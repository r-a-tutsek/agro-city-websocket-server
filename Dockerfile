FROM node:18.16.1-alpine

WORKDIR /usr/src/app

COPY . .

RUN npm install
RUN npm run-script build

EXPOSE 8080

CMD [ "node", "dist/server.js" ]