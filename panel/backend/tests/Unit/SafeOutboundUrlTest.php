<?php

namespace Tests\Unit;

use App\Services\Security\OutboundUrlGuard;
use InvalidArgumentException;
use Tests\TestCase;

class SafeOutboundUrlTest extends TestCase
{
    public function test_rejects_private_ip_literal(): void
    {
        $this->expectException(InvalidArgumentException::class);
        OutboundUrlGuard::assertSafeHttpUrl('http://127.0.0.1/admin');
    }

    public function test_accepts_public_ip_literal(): void
    {
        OutboundUrlGuard::assertSafeHttpUrl('http://8.8.8.8/');
        $this->assertTrue(true);
    }

    public function test_rejects_hostname_with_no_dns_records(): void
    {
        $this->expectException(InvalidArgumentException::class);
        OutboundUrlGuard::assertSafeHttpUrl('http://no-dns-records-xxxxx.invalid/');
    }
}
