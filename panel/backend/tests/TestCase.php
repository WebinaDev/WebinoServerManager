<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Testing\TestResponse;

abstract class TestCase extends BaseTestCase
{
    /**
     * Panel module routes register as /v1/* while the Next.js proxy and docs use /api/v1/*.
     * Normalize Feature test URIs so both forms work.
     */
    public function json($method, $uri, array $data = [], array $headers = [], $options = 0): TestResponse
    {
        if (is_string($uri) && str_starts_with($uri, '/api/')) {
            $uri = substr($uri, 4);
        }

        return parent::json($method, $uri, $data, $headers, $options);
    }
}
