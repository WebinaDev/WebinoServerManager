<?php

namespace App\Rules;

use App\Services\Security\OutboundUrlGuard;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use InvalidArgumentException;

class SafeUptimeTarget implements ValidationRule
{
    public function __construct(private readonly string $type) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            $fail('Target is required.');

            return;
        }

        try {
            if ($this->type === 'http') {
                OutboundUrlGuard::assertSafeHttpUrl($value);
            } elseif ($this->type === 'tcp') {
                OutboundUrlGuard::assertSafeTcpTarget($value);
            } else {
                $fail('Invalid uptime check type.');
            }
        } catch (InvalidArgumentException $e) {
            $fail($e->getMessage());
        }
    }
}
