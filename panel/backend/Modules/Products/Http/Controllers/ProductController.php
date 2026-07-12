<?php

namespace Modules\Products\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function index(): JsonResponse
    {
        $result = $this->agent->webina(['product', 'list']);

        return response()->json($result);
    }

    public function install(Request $request): JsonResponse
    {
        $data = $request->validate([
            'product' => ['required', 'in:Webino,WebinoERM'],
            'channel' => ['nullable', 'in:Dev,LTS,Beta'],
        ]);
        $args = ['product', 'install', $data['product']];
        if (! empty($data['channel'])) {
            $args[] = '--channel';
            $args[] = $data['channel'];
        }
        $result = $this->agent->webina($args);

        return response()->json($result);
    }
}
