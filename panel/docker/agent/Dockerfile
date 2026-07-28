FROM golang:1.22-bookworm AS builder
ARG GOPROXY="https://proxy.golang.org|https://goproxy.io|direct"
ENV GOPROXY=${GOPROXY}
ENV GOSUMDB=off
WORKDIR /src
COPY go.mod ./
COPY *.go ./
RUN go mod tidy && CGO_ENABLED=0 go build -o /webino-agent .

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates mariadb-client bash procps tar gzip git php-cli curl docker.io \
    util-linux pdns-tools postfix dovecot-core dovecot-imapd nginx \
    && (curl -fsSL --retry 4 --retry-all-errors \
          https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar -o /usr/local/bin/wp \
        || curl -fsSL --retry 4 --retry-all-errors \
          https://github.com/wp-cli/wp-cli/releases/latest/download/wp-cli.phar -o /usr/local/bin/wp) \
    && chmod +x /usr/local/bin/wp \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /webino-agent /usr/local/bin/webino-agent
ENTRYPOINT ["/usr/local/bin/webino-agent"]
