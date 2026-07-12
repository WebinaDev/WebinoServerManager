<?php

namespace Modules\Dns\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Services\Agent\AgentClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Dns\Entities\DnsRecord;
use Modules\Dns\Entities\DnsZone;

class DnsController extends Controller
{
    public function __construct(private readonly AgentClient $agent) {}

    public function indexZones(): JsonResponse
    {
        $zones = DnsZone::query()->with('records')->orderBy('domain')->get();

        return response()->json(['zones' => $zones]);
    }

    public function indexTemplates(): JsonResponse
    {
        $templates = DB::table('dns_templates')->orderBy('name')->get();

        return response()->json(['templates' => $templates]);
    }

    public function indexRecords(DnsZone $zone): JsonResponse
    {
        $result = $this->agent->get('/v1/dns/records?domain='.urlencode($zone->domain));
        $live = [];
        if ($result['ok'] ?? false) {
            $data = $result['data'] ?? [];
            if (is_string($data)) {
                $data = json_decode($data, true) ?? [];
            }
            $live = $data['records'] ?? [];
        }

        return response()->json([
            'zone' => $zone->load('records'),
            'live_records' => $live,
        ]);
    }

    public function storeZone(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253', 'unique:dns_zones,domain'],
        ]);

        $zone = DnsZone::query()->create([
            'domain' => strtolower($data['domain']),
            'zone_kind' => 'native',
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/dns/zones', [
            'domain' => $zone->domain,
            'action' => 'create',
        ]);

        if (! ($result['ok'] ?? false)) {
            $zone->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('dns.provision_failed'), 'zone' => $zone], 422);
        }

        $zone->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['zone' => $zone->fresh()->load('records'), 'agent' => $result], 201);
    }

    public function storeSlaveZone(Request $request): JsonResponse
    {
        $data = $request->validate([
            'domain' => ['required', 'string', 'max:253', 'unique:dns_zones,domain'],
            'master_ns' => ['required', 'string', 'max:253'],
        ]);

        $zone = DnsZone::query()->create([
            'domain' => strtolower($data['domain']),
            'zone_kind' => 'slave',
            'master_ns' => $data['master_ns'],
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/dns/zones', [
            'domain' => $zone->domain,
            'action' => 'slave',
            'master_ns' => $zone->master_ns,
        ]);

        if (! ($result['ok'] ?? false)) {
            $zone->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('dns.provision_failed'), 'zone' => $zone], 422);
        }

        $zone->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['zone' => $zone->fresh(), 'agent' => $result], 201);
    }

    public function destroyZone(DnsZone $zone): JsonResponse
    {
        $this->agent->post('/v1/dns/zones', [
            'domain' => $zone->domain,
            'action' => 'delete',
        ]);
        $zone->delete();

        return response()->json(['message' => __('dns.zone_deleted')]);
    }

    public function enableDnssec(DnsZone $zone): JsonResponse
    {
        $result = $this->agent->post('/v1/dns/zones', [
            'domain' => $zone->domain,
            'action' => 'dnssec_enable',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.dnssec_failed')], 422);
        }

        $zone->update(['dnssec_enabled' => true]);

        return response()->json(['zone' => $zone->fresh(), 'agent' => $result]);
    }

    public function disableDnssec(DnsZone $zone): JsonResponse
    {
        $result = $this->agent->post('/v1/dns/zones', [
            'domain' => $zone->domain,
            'action' => 'dnssec_disable',
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.dnssec_failed')], 422);
        }

        $zone->update(['dnssec_enabled' => false]);

        return response()->json(['zone' => $zone->fresh(), 'agent' => $result]);
    }

    public function importZone(Request $request, DnsZone $zone): JsonResponse
    {
        $data = $request->validate([
            'content' => ['required', 'string'],
        ]);

        $result = $this->agent->post('/v1/dns/zones', [
            'domain' => $zone->domain,
            'action' => 'import',
            'content' => $data['content'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.import_failed')], 422);
        }

        return response()->json(['zone' => $zone->fresh()->load('records'), 'agent' => $result]);
    }

    public function exportZone(DnsZone $zone): JsonResponse
    {
        $result = $this->agent->get('/v1/dns/zones?export=1&domain='.urlencode($zone->domain));

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.export_failed')], 422);
        }

        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $data = json_decode($data, true) ?? [];
        }

        return response()->json([
            'domain' => $zone->domain,
            'content' => $data['content'] ?? '',
        ]);
    }

    public function applyTemplate(Request $request, DnsZone $zone): JsonResponse
    {
        $data = $request->validate([
            'template' => ['required', 'string', 'max:64'],
        ]);

        $result = $this->agent->post('/v1/dns/zones', [
            'domain' => $zone->domain,
            'action' => 'apply_template',
            'template' => $data['template'],
        ]);

        if (! ($result['ok'] ?? false)) {
            return response()->json(['message' => $result['error'] ?? __('dns.template_failed')], 422);
        }

        $zone->update(['template' => $data['template']]);

        return response()->json(['zone' => $zone->fresh()->load('records'), 'agent' => $result]);
    }

    public function storeRecord(Request $request): JsonResponse
    {
        $data = $request->validate([
            'zone_id' => ['required', 'exists:dns_zones,id'],
            'type' => ['required', 'string', 'max:16'],
            'name' => ['required', 'string', 'max:255'],
            'content' => ['required', 'string'],
            'ttl' => ['nullable', 'integer', 'min:60'],
            'priority' => ['nullable', 'integer', 'min:0'],
        ]);

        $zone = DnsZone::query()->findOrFail($data['zone_id']);
        $record = DnsRecord::query()->create([
            'zone_id' => $zone->id,
            'type' => strtoupper($data['type']),
            'name' => $data['name'],
            'content' => $data['content'],
            'ttl' => $data['ttl'] ?? 3600,
            'priority' => $data['priority'] ?? null,
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/dns/records', [
            'domain' => $zone->domain,
            'type' => $record->type,
            'name' => $record->name,
            'content' => $record->content,
            'ttl' => $record->ttl,
            'priority' => $record->priority,
            'action' => 'create',
        ]);

        if (! ($result['ok'] ?? false)) {
            $record->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('dns.record_failed'), 'record' => $record], 422);
        }

        $record->update(['status' => 'active', 'last_error' => null]);

        return response()->json(['record' => $record->fresh(), 'agent' => $result], 201);
    }

    public function updateRecord(Request $request, DnsRecord $record): JsonResponse
    {
        $data = $request->validate([
            'type' => ['sometimes', 'string', 'max:16'],
            'name' => ['sometimes', 'string', 'max:255'],
            'content' => ['sometimes', 'string'],
            'ttl' => ['nullable', 'integer', 'min:60'],
            'priority' => ['nullable', 'integer', 'min:0'],
        ]);

        $zone = $record->zone;
        $oldName = $record->name;
        $oldType = $record->type;

        $record->fill([
            'type' => isset($data['type']) ? strtoupper($data['type']) : $record->type,
            'name' => $data['name'] ?? $record->name,
            'content' => $data['content'] ?? $record->content,
            'ttl' => $data['ttl'] ?? $record->ttl,
            'priority' => array_key_exists('priority', $data) ? $data['priority'] : $record->priority,
            'status' => 'pending',
        ]);

        $result = $this->agent->post('/v1/dns/records', [
            'domain' => $zone->domain,
            'type' => $record->type,
            'name' => $record->name,
            'content' => $record->content,
            'ttl' => $record->ttl,
            'priority' => $record->priority,
            'action' => 'update',
            'old_name' => $oldName,
            'old_type' => $oldType,
        ]);

        if (! ($result['ok'] ?? false)) {
            $record->update(['status' => 'error', 'last_error' => $result['error'] ?? 'agent error']);

            return response()->json(['message' => $result['error'] ?? __('dns.record_failed'), 'record' => $record], 422);
        }

        $record->status = 'active';
        $record->last_error = null;
        $record->save();

        return response()->json(['record' => $record->fresh(), 'agent' => $result]);
    }

    public function destroyRecord(DnsRecord $record): JsonResponse
    {
        $zone = $record->zone;
        $this->agent->post('/v1/dns/records', [
            'domain' => $zone->domain,
            'type' => $record->type,
            'name' => $record->name,
            'content' => $record->content,
            'action' => 'delete',
        ]);
        $record->delete();

        return response()->json(['message' => __('dns.record_deleted')]);
    }
}
