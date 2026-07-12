<?php

namespace App\Support;

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Route as RouteFacade;

class OpenApiRouteCatalog
{
    /** @var list<string> */
    private const PUBLIC_PATHS = [
        '/setup/status',
        '/setup',
        '/auth/login',
        '/auth/session',
        '/auth/gate',
        '/auth/forgot-password',
        '/auth/reset-password',
        '/mail/status',
        '/openapi.json',
    ];

    /**
     * @return array<string, mixed>
     */
    public function build(): array
    {
        $paths = [];

        foreach (RouteFacade::getRoutes() as $route) {
            $path = $this->apiPath($route);
            if ($path === null) {
                continue;
            }

            foreach ($route->methods() as $method) {
                if (in_array($method, ['HEAD', 'OPTIONS'], true)) {
                    continue;
                }
                $lower = strtolower($method);
                $paths[$path][$lower] = [
                    'summary' => $this->summary($route, $method),
                    'operationId' => $this->operationId($path, $lower),
                    'responses' => [
                        '200' => ['description' => 'OK'],
                        '201' => ['description' => 'Created'],
                        '204' => ['description' => 'No Content'],
                        '401' => ['description' => 'Unauthorized'],
                        '403' => ['description' => 'Forbidden'],
                        '422' => ['description' => 'Validation error'],
                    ],
                ];
                if ($this->isPublic($path, $lower)) {
                    $paths[$path][$lower]['security'] = [];
                }
            }
        }

        ksort($paths);

        return [
            'openapi' => '3.1.0',
            'info' => [
                'title' => 'WebinoServer API',
                'version' => '1.0.0',
                'description' => 'WebinoServer hosting control panel API. Regenerate with: php artisan panel:export-openapi',
            ],
            'servers' => [['url' => '/api/v1']],
            'security' => [['bearerAuth' => []]],
            'components' => [
                'securitySchemes' => [
                    'bearerAuth' => [
                        'type' => 'http',
                        'scheme' => 'bearer',
                        'bearerFormat' => 'JWT',
                    ],
                ],
            ],
            'paths' => $paths,
        ];
    }

    private function apiPath(Route $route): ?string
    {
        $uri = $route->uri();
        if (! str_starts_with($uri, 'api/v1')) {
            return null;
        }
        $suffix = substr($uri, strlen('api/v1'));
        if ($suffix === '' || $suffix === '/') {
            return '/';
        }

        return '/'.ltrim($suffix, '/');
    }

    private function summary(Route $route, string $method): string
    {
        $name = $route->getName() ?? $route->getActionName();

        return trim($method.' '.$name);
    }

    private function operationId(string $path, string $method): string
    {
        $slug = preg_replace('/[^a-zA-Z0-9]+/', '_', trim($path, '/')) ?: 'root';

        return $method.'_'.$slug;
    }

    private function isPublic(string $path, string $method): bool
    {
        if ($method === 'post' && $path === '/setup') {
            return true;
        }

        return in_array($path, self::PUBLIC_PATHS, true);
    }
}
