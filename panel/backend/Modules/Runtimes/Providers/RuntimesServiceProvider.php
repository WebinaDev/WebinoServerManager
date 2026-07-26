<?php

namespace Modules\Runtimes\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Runtimes\Entities\RuntimeVersion;

class RuntimesServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Runtimes', 'Routes/api.php'));
    }

    public static function seedCatalog(): void
    {
        $rows = [
            [
                'slug' => 'node-nvm',
                'runtime' => 'node',
                'name' => 'Node.js (nvm LTS)',
                'install_method' => 'nvm',
                'agent_script_id' => 'install_node_nvm',
                'version_label' => 'lts',
            ],
            [
                'slug' => 'node-nodesource',
                'runtime' => 'node',
                'name' => 'Node.js 20 (NodeSource)',
                'install_method' => 'nodesource',
                'agent_script_id' => 'install_node_nodesource',
                'version_label' => '20.x',
            ],
            [
                'slug' => 'python-distro',
                'runtime' => 'python',
                'name' => 'Python 3 (distro packages)',
                'install_method' => 'distro',
                'agent_script_id' => 'install_python_distro',
                'version_label' => '3',
            ],
            [
                'slug' => 'go-distro',
                'runtime' => 'go',
                'name' => 'Go (distro packages)',
                'install_method' => 'distro',
                'agent_script_id' => 'install_go_distro',
                'version_label' => 'distro',
            ],
        ];

        foreach ($rows as $row) {
            RuntimeVersion::query()->updateOrCreate(
                ['slug' => $row['slug']],
                $row,
            );
        }
    }
}
