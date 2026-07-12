<?php

namespace Modules\Core\Console\Commands;

use Illuminate\Console\Command;

class ExportRoutePermissionsCommand extends Command
{
    protected $signature = 'panel:export-route-permissions';

    protected $description = 'Export canonical route permissions as JSON for CI drift checks';

    public function handle(): int
    {
        $payload = [
            'read' => config('route_permissions', []),
            'write' => config('route_write_permissions', []),
        ];

        $this->line(json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));

        return self::SUCCESS;
    }
}
