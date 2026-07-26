<?php

namespace Tests\Feature;

use App\Support\OpenApiRouteCatalog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OpenApiExportTest extends TestCase
{
    use RefreshDatabase;

    public function test_route_catalog_has_minimum_path_count(): void
    {
        $spec = app(OpenApiRouteCatalog::class)->build();
        $paths = $spec['paths'] ?? [];

        $this->assertGreaterThanOrEqual(200, count($paths), 'OpenAPI path count regressed');
    }

    public function test_committed_openapi_json_matches_catalog(): void
    {
        $path = storage_path('app/openapi.json');
        $this->assertFileExists($path);

        $committed = json_decode(file_get_contents($path), true);
        $catalog = app(OpenApiRouteCatalog::class)->build();

        $this->assertIsArray($committed['paths'] ?? null);
        $this->assertSame(
            count($catalog['paths'] ?? []),
            count($committed['paths'] ?? []),
            'Run: php artisan panel:export-openapi',
        );
    }
}
