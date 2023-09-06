FROM node

WORKDIR /usr/plant-store

COPY . .

RUN npm install

CMD ["npm", "start"]