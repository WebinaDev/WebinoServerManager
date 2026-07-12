<?php

namespace App\Rules;

use App\Services\Security\OutboundUrlGuard;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use InvalidArgumentException;

class SafeOutboundUrl implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value)) {
            $fail(__('validation.url'));

            return;
        }

        try {
            OutboundUrlGuard::assertSafeHttpUrl($value);
        } catch (InvalidArgumentException $e) {
            $fail($e->getMessage());
        }
    }
}
