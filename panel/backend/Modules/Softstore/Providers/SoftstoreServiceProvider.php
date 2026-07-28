<?php

namespace Modules\Softstore\Providers;

use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Modules\Core\Support\ModuleRoutes;
use Modules\Softstore\Entities\SoftstorePackage;

class SoftstoreServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        ModuleRoutes::load('Softstore');

        try {
            if (! $this->app->runningUnitTests() && Schema::hasTable('softstore_packages')) {
                static::seedCatalog();
            }
        } catch (\Throwable) {
            // Database may be unavailable during early boot / package discovery.
        }
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
                'slug' => 'wordpress-cms',
                'name' => 'WordPress (one-click)',
                'category' => 'cms',
                'description' => 'Install WordPress via wp-cli into a website document root (complete DB/admin in WordPress toolkit if needed)',
                'version_label' => 'latest',
                'agent_script_id' => 'install_wordpress_cms',
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
            [
                'slug' => 'node-nvm',
                'name' => 'Node.js (nvm LTS)',
                'category' => 'runtime',
                'description' => 'Install Node.js via nvm — see also /runtimes for project management',
                'version_label' => 'lts',
                'agent_script_id' => 'install_node_nvm',
                'pinable' => true,
            ],
            [
                'slug' => 'python-distro',
                'name' => 'Python 3 (distro)',
                'category' => 'runtime',
                'description' => 'Install Python 3 via apt — see also /runtimes for project management',
                'version_label' => '3',
                'agent_script_id' => 'install_python_distro',
                'pinable' => true,
            ],
            [
                'slug' => 'go-distro',
                'name' => 'Go (distro)',
                'category' => 'runtime',
                'description' => 'Install Go via apt — see also /runtimes for project management',
                'version_label' => 'distro',
                'agent_script_id' => 'install_go_distro',
                'pinable' => true,
            ],
            [
                'slug' => 'java-distro',
                'name' => 'OpenJDK',
                'category' => 'runtime',
                'description' => 'Install OpenJDK (17/21/default via apt) — see also /runtimes for project management',
                'version_label' => '17+',
                'agent_script_id' => 'install_java_distro',
                'pinable' => true,
            ],
            // First-run hosting stack (setup wizard)
            [
                'slug' => 'nginx',
                'name' => 'Nginx',
                'category' => 'stack',
                'description' => 'Host nginx web server',
                'version_label' => 'distro',
                'agent_script_id' => 'install_nginx',
                'pinable' => true,
            ],
            [
                'slug' => 'apache',
                'name' => 'Apache',
                'category' => 'stack',
                'description' => 'Host apache2 web server',
                'version_label' => 'distro',
                'agent_script_id' => 'install_apache',
                'pinable' => true,
            ],
            [
                'slug' => 'mariadb',
                'name' => 'MariaDB',
                'category' => 'stack',
                'description' => 'MariaDB server for site databases',
                'version_label' => 'distro',
                'agent_script_id' => 'install_mariadb',
                'pinable' => true,
            ],
            [
                'slug' => 'mysql',
                'name' => 'MySQL',
                'category' => 'stack',
                'description' => 'MySQL server for site databases',
                'version_label' => 'distro',
                'agent_script_id' => 'install_mysql',
                'pinable' => true,
            ],
            [
                'slug' => 'php-fpm-81',
                'name' => 'PHP 8.1 FPM',
                'category' => 'stack',
                'description' => 'PHP 8.1 FPM + common extensions',
                'version_label' => '8.1',
                'agent_script_id' => 'install_php_fpm_81',
                'pinable' => true,
            ],
            [
                'slug' => 'php-fpm-82',
                'name' => 'PHP 8.2 FPM',
                'category' => 'stack',
                'description' => 'PHP 8.2 FPM + common extensions',
                'version_label' => '8.2',
                'agent_script_id' => 'install_php_fpm_82',
                'pinable' => true,
            ],
            [
                'slug' => 'php-fpm-83',
                'name' => 'PHP 8.3 FPM',
                'category' => 'stack',
                'description' => 'PHP 8.3 FPM + common extensions',
                'version_label' => '8.3',
                'agent_script_id' => 'install_php_fpm_83',
                'pinable' => true,
            ],
            [
                'slug' => 'php-fpm-84',
                'name' => 'PHP 8.4 FPM',
                'category' => 'stack',
                'description' => 'PHP 8.4 FPM + common extensions',
                'version_label' => '8.4',
                'agent_script_id' => 'install_php_fpm_84',
                'pinable' => true,
            ],
            [
                'slug' => 'ufw',
                'name' => 'UFW firewall',
                'category' => 'stack',
                'description' => 'UFW with ports 22/80/443/2090',
                'version_label' => 'baseline',
                'agent_script_id' => 'ensure_ufw_baseline',
                'pinable' => false,
            ],
            [
                'slug' => 'fail2ban',
                'name' => 'Fail2ban',
                'category' => 'stack',
                'description' => 'Intrusion prevention (fail2ban)',
                'version_label' => 'distro',
                'agent_script_id' => 'ensure_fail2ban',
                'pinable' => true,
            ],
            [
                'slug' => 'pureftpd',
                'name' => 'Pure-FTPd',
                'category' => 'stack',
                'description' => 'FTP server for hosting accounts',
                'version_label' => 'distro',
                'agent_script_id' => 'install_pureftpd',
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
