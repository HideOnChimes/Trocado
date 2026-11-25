# Imagem do app: gera o site e sobe o servidor. Precisa de Node 22.9+ (node:sqlite embutido).
FROM node:24-slim AS site
WORKDIR /app
COPY web/package.json web/package-lock.json web/
RUN npm --prefix web ci
COPY web web
RUN npm --prefix web run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
COPY server/package.json server/package-lock.json server/
RUN npm --prefix server ci --omit=dev
COPY server server
COPY --from=site /app/web/dist web/dist
# Banco de dados: monte um volume aqui, senão o histórico some a cada deploy.
VOLUME /app/server/data
EXPOSE 8080
CMD ["node", "server/index.mjs"]
