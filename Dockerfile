FROM golang:latest AS aptly_build
WORKDIR /tmp
RUN git clone https://github.com/aptly-dev/aptly.git aptly
WORKDIR /tmp/aptly
RUN go build -o /tmp/aptly_bin ./

FROM node:latest
COPY --from=aptly_build /tmp/aptly_bin /usr/local/bin/aptly
WORKDIR /app
ENTRYPOINT [ "node", "index.js", "--express=80", "--cron", "--docker", "--save_path=/root/.DebianRepo/" ]
EXPOSE 80/tcp
VOLUME [ "/root/.DebianRepo/" ]
COPY ./package*.json ./
RUN npm install --no-save -d
COPY . .