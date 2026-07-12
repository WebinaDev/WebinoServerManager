FROM node:22-alpine
RUN apk add --no-cache curl
WORKDIR /app
ARG OPENAPI_URL=http://panel-api:8080/api/v1/openapi.json
COPY package.json ./
RUN npm install
COPY . .
RUN mkdir -p static && (curl -sf "$OPENAPI_URL" -o static/openapi.json || echo '{"openapi":"3.1.0","info":{"title":"WebinoServer","version":"1.0.0"},"paths":{}}' > static/openapi.json)
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "serve", "--", "--host", "0.0.0.0", "--port", "3000"]
