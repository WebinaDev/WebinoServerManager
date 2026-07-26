<?php

namespace Modules\Core\Services;

/**
 * Builds ordered Softstore script steps for the first-run hosting stack wizard.
 *
 * @phpstan-type StackConfig array{
 *   skip?: bool,
 *   webserver?: string,
 *   database?: string,
 *   php_versions?: list<string>,
 *   redis?: bool,
 *   memcached?: bool,
 *   pureftpd?: bool
 * }
 */
final class SetupStackPlanner
{
    /**
     * @param  StackConfig  $config
     * @return list<array{slug: string, script_id: string, label: string}>
     */
    public function plan(array $config): array
    {
        if (! empty($config['skip'])) {
            return [];
        }

        $webserver = strtolower((string) ($config['webserver'] ?? 'nginx'));
        $database = strtolower((string) ($config['database'] ?? 'mariadb'));
        $phpVersions = $config['php_versions'] ?? ['8.2', '8.3'];
        if (! is_array($phpVersions) || $phpVersions === []) {
            $phpVersions = ['8.2', '8.3'];
        }

        $steps = [];

        if ($webserver === 'apache') {
            $steps[] = ['slug' => 'apache', 'script_id' => 'install_apache', 'label' => 'Apache'];
        } else {
            $steps[] = ['slug' => 'nginx', 'script_id' => 'install_nginx', 'label' => 'Nginx'];
        }

        if ($database === 'mysql') {
            $steps[] = ['slug' => 'mysql', 'script_id' => 'install_mysql', 'label' => 'MySQL'];
        } else {
            $steps[] = ['slug' => 'mariadb', 'script_id' => 'install_mariadb', 'label' => 'MariaDB'];
        }

        $phpMap = [
            '8.1' => ['slug' => 'php-fpm-81', 'script_id' => 'install_php_fpm_81', 'label' => 'PHP 8.1'],
            '8.2' => ['slug' => 'php-fpm-82', 'script_id' => 'install_php_fpm_82', 'label' => 'PHP 8.2'],
            '8.3' => ['slug' => 'php-fpm-83', 'script_id' => 'install_php_fpm_83', 'label' => 'PHP 8.3'],
            '8.4' => ['slug' => 'php-fpm-84', 'script_id' => 'install_php_fpm_84', 'label' => 'PHP 8.4'],
        ];
        foreach ($phpVersions as $ver) {
            $key = (string) $ver;
            if (isset($phpMap[$key])) {
                $steps[] = $phpMap[$key];
            }
        }

        $steps[] = ['slug' => 'composer', 'script_id' => 'ensure_composer', 'label' => 'Composer'];
        $steps[] = ['slug' => 'ufw', 'script_id' => 'ensure_ufw_baseline', 'label' => 'UFW firewall'];
        $steps[] = ['slug' => 'fail2ban', 'script_id' => 'ensure_fail2ban', 'label' => 'Fail2ban'];

        if (! empty($config['redis'])) {
            $steps[] = ['slug' => 'redis', 'script_id' => 'install_redis', 'label' => 'Redis'];
        }
        if (! empty($config['memcached'])) {
            $steps[] = ['slug' => 'memcached', 'script_id' => 'install_memcached', 'label' => 'Memcached'];
        }
        if (! empty($config['pureftpd'])) {
            $steps[] = ['slug' => 'pureftpd', 'script_id' => 'install_pureftpd', 'label' => 'Pure-FTPd'];
        }

        return $steps;
    }
}
