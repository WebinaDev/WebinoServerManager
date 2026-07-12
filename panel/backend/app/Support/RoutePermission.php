<?php

namespace App\Support;

class RoutePermission
{
    public static function forPath(string $path): ?string
    {
        $path = '/'.trim($path, '/');
        if ($path === '/') {
            return null;
        }

        $map = config('route_permissions', []);
        $best = null;
        $bestLen = -1;

        foreach ($map as $prefix => $permission) {
            $prefix = '/'.trim((string) $prefix, '/');
            if ($path === $prefix || str_starts_with($path, $prefix.'/')) {
                if (strlen($prefix) > $bestLen) {
                    $bestLen = strlen($prefix);
                    $best = $permission;
                }
            }
        }

        return $best;
    }
}
