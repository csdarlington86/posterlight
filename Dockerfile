# PosterLight helper. No build step and no dependencies: the image is Node plus the files.
FROM node:22-alpine

WORKDIR /app
COPY package.json server.js ./
COPY lib ./lib
COPY public ./public
COPY scripts ./scripts

# Settings and state live in /data, so they survive an update of the image.
ENV POSTERLIGHT_CONFIG=/data/config.json \
    POSTERLIGHT_DATA=/data \
    PORT=8686
RUN mkdir /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 8686

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8686)+'/healthz').then(function(r){process.exit(r.ok?0:1)},function(){process.exit(1)})"

CMD ["node", "server.js"]
