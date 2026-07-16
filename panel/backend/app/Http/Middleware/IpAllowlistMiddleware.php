<?php

namespace App\Http\Middleware;

use App\Models\PanelSetting;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class IpAllowlistMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            if (! Schema::hasTable('panel_settings')) {
                return $next($request);
            }
        } catch (\Throwable) {
            return $next($request);
        }

        $raw = trim((string) PanelSetting::get('api_ip_allowlist', ''));
        if ($raw === '') {
            return $next($request);
        }

        $clientIp = $request->ip();
        foreach (array_filter(array_map('trim', explode(',', $raw))) as $allowed) {
            if ($this->matches($clientIp, $allowed)) {
                return $next($request);
            }
        }

        return response()->json(['message' => __('auth.forbidden_ip')], 403);
    }

    private function matches(?string $clientIp, string $allowed): bool
    {
        if ($clientIp === null || $clientIp === '') {
            return false;
        }
        if ($clientIp === $allowed) {
            return true;
        }
        if (! str_contains($allowed, '/')) {
            return false;
        }

        [$subnet, $bits] = explode('/', $allowed, 2);
        if (! is_numeric($bits)) {
            return false;
        }

        $clientBin = @inet_pton($clientIp);
        $subnetBin = @inet_pton($subnet);
        if ($clientBin === false || $subnetBin === false || strlen($clientBin) !== strlen($subnetBin)) {
            return false;
        }

        $mask = str_repeat("\xff", (int) $bits >> 3);
        $remainder = (int) $bits % 8;
        if ($remainder > 0) {
            $mask .= chr(0xff << (8 - $remainder) & 0xff);
        }
        $mask = str_pad($mask, strlen($clientBin), "\x00");

        return ($clientBin & $mask) === ($subnetBin & $mask);
    }
}
