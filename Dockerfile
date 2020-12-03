FROM node:14-alpine

WORKDIR /app

COPY ./src /app/src
COPY package.json /app/package.json
COPY tsconfig.json /app/tsconfig.json

RUN npm install
RUN npm run build

CMD [ "node", "./dist/index.js" ]
