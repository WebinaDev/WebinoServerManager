<?php

namespace Modules\Softstore\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Softstore\Entities\SoftstorePackage;

class SoftstoreServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->loadRoutesFrom(module_path('Softstore', 'Routes/api.php'));
    }

    public static function seedCatalog(): void
    {
        $packages = [
            [
                'slug' => 'redis',
                'name' => 'Redis',
                'category' => 'runtime',
                'description' => 'In-memory data store (redis-server)',
                'version_label' => 'distro',
                'agent_script_id' => 'install_redis',
                'pinable' => true,
            ],
            [
                'slug' => 'memcached',
                'name' => 'Memcached',
                'category' => 'runtime',
                'description' => 'Distributed memory object caching',
                'version_label' => 'distro',
                'agent_script_id' => 'install_memcached',
                'pinable' => true,
            ],
            [
                'slug' => 'composer',
                'name' => 'Composer',
                'category' => 'tool',
                'description' => 'PHP dependency manager',
                'version_label' => 'distro',
                'agent_script_id' => 'ensure_composer',
                'pinable' => true,
            ],
            [
                'slug' => 'cms-stub',
                'name' => 'CMS Composer stub',
                'category' => 'cms',
                'description' => 'Run composer install in a selected website document root (no remote download)',
                'version_label' => 'stub',
                'agent_script_id' => 'cms_composer_stub',
                'pinable' => true,
            ],
            [
                'slug' => 'docker-redis',
                'name' => 'Redis (Docker Compose)',
                'category' => 'docker',
                'description' => 'One-click redis:7-alpine via fixed compose template',
                'version_label' => 'compose',
                'agent_script_id' => 'compose_up_redis',
                'pinable' => true,
            ],
            [
                'slug' => 'docker-nginx',
                'name' => 'Nginx (Docker Compose)',
                'category' => 'docker',
                'description' => 'One-click nginx:alpine via fixed compose template (port 8088)',
                'version_label' => 'compose',
                'agent_script_id' => 'compose_up_nginx',
                'pinable' => true,
            ],
        ];

        foreach ($packages as $row) {
            SoftstorePackage::query()->updateOrCreate(
                ['slug' => $row['slug']],
                $row,
            );
        }
    }
}
