<?php

namespace Modules\Core\Console\Commands;

use App\Support\OpenApiRouteCatalog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;

class ExportOpenApiCommand extends Command
{
    protected $signature = 'panel:export-openapi';

    protected $description = 'Export OpenAPI spec from registered api/v1 routes';

    public function handle(OpenApiRouteCatalog $catalog): int
    {
        $spec = $catalog->build();
        $path = storage_path('app/openapi.json');
        File::put($path, json_encode($spec, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)."\n");
        $count = count($spec['paths'] ?? []);
        $this->info("Exported {$count} paths to {$path}");

        return self::SUCCESS;
    }
}
