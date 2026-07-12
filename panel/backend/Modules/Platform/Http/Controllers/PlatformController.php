<?php

namespace Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function status(): JsonResponse
    {
        $result = $this->agent->webina(['platform', 'status']);

        return response()->json($result);
    }

    public function init(): JsonResponse
    {
        $result = $this->agent->webina(['platform', 'init']);

        return response()->json($result);
    }

    public function sites(): JsonResponse
    {
        $result = $this->agent->webina(['site', 'list']);

        return response()->json($result);
    }

    public function createSite(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slug' => ['required', 'string'],
            'domain' => ['required', 'string'],
            'product' => ['nullable', 'string'],
            'channel' => ['nullable', 'string', 'in:Dev,LTS,Beta'],
            'aliases' => ['nullable', 'array'],
            'aliases.*' => ['string'],
            'env' => ['nullable', 'array'],
        ]);
        $args = ['site', 'create', '--slug', $data['slug'], '--domain', $data['domain']];
        if (! empty($data['product'])) {
            $args[] = '--product';
            $args[] = $data['product'];
        }
        if (! empty($data['channel'])) {
            $args[] = '--channel';
            $args[] = $data['channel'];
        }
        if (! empty($data['aliases'])) {
            $args[] = '--alias';
            $args[] = implode(',', $data['aliases']);
        }
        if (! empty($data['env'])) {
            $args[] = '--env-patch-base64';
            $args[] = base64_encode(json_encode($data['env'], JSON_THROW_ON_ERROR));
        }
        $result = $this->agent->webina($args);

        if (($result['ok'] ?? false) === true) {
            app(\Modules\Webhooks\Services\WebhookDispatcher::class)->dispatch('site.created', [
                'slug' => $data['slug'],
                'domain' => $data['domain'],
                'product' => $data['product'] ?? 'Webino',
            ]);
        } else {
            app(\Modules\Webhooks\Services\WebhookDispatcher::class)->dispatch('site.failed', [
                'slug' => $data['slug'],
                'domain' => $data['domain'],
                'error' => $result['error'] ?? 'unknown',
            ]);
        }

        return response()->json($result);
    }

    public function destroySite(string $slug): JsonResponse
    {
        $slug = trim($slug);
        if ($slug === '') {
            return response()->json(['message' => 'slug required'], 422);
        }

        $result = $this->agent->webina(['site', 'delete', '--slug', $slug, '--yes']);

        return response()->json($result, ($result['ok'] ?? false) ? 200 : 422);
    }
}
