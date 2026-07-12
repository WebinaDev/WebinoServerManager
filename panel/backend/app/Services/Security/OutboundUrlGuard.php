<?php

namespace App\Services\Security;

use InvalidArgumentException;

class OutboundUrlGuard
{
    public static function assertSafeHttpUrl(string $url): void
    {
        if ($url === '') {
            throw new InvalidArgumentException(__('validation.url'));
        }

        $parts = parse_url($url);
        if ($parts === false || empty($parts['host'])) {
            throw new InvalidArgumentException(__('validation.url'));
        }

        if (app()->environment('production') && ($parts['scheme'] ?? '') !== 'https') {
            throw new InvalidArgumentException('URL must use HTTPS in production.');
        }

        self::assertSafeHost((string) $parts['host']);
    }

    public static function assertSafeTcpTarget(string $target): void
    {
        $host = $target;
        $port = '443';
        if (str_contains($target, ':')) {
            [$host, $port] = array_pad(explode(':', $target, 2), 2, '443');
        }

        $host = strtolower(trim($host));
        $port = trim($port);

        if ($host === '' || ! ctype_digit($port) || (int) $port < 1 || (int) $port > 65535) {
            throw new InvalidArgumentException('Invalid TCP target format (use host:port).');
        }

        self::assertSafeHost($host);
    }

    public static function assertSafeHost(string $host): void
    {
        $host = strtolower(trim($host));

        if ($host === 'localhost' || $host === 'metadata.google.internal') {
            throw new InvalidArgumentException('URL must not target internal hosts.');
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            if (self::isPrivateIp($host)) {
                throw new InvalidArgumentException('URL must not target private or link-local addresses.');
            }

            return;
        }

        $ips = self::resolveHostIps($host);
        if ($ips === []) {
            throw new InvalidArgumentException('URL hostname must resolve to a public address.');
        }

        foreach ($ips as $ip) {
            if (self::isPrivateIp($ip)) {
                throw new InvalidArgumentException('URL must not resolve to private or link-local addresses.');
            }
        }
    }

    /**
     * @return list<string>
     */
    public static function resolveHostIps(string $host): array
    {
        $records = @dns_get_record($host, DNS_A + DNS_AAAA);
        if (! is_array($records)) {
            return [];
        }

        $ips = [];
        foreach ($records as $record) {
            if (! empty($record['ip'])) {
                $ips[] = $record['ip'];
            }
            if (! empty($record['ipv6'])) {
                $ips[] = $record['ipv6'];
            }
        }

        return $ips;
    }

    private static function isPrivateIp(string $ip): bool
    {
        if (! filter_var($ip, FILTER_VALIDATE_IP)) {
            return true;
        }

        return ! filter_var(
            $ip,
            FILTER_VALIDATE_IP,
            FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE,
        );
    }
}
