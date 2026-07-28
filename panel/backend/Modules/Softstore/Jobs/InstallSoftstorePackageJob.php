<?php

namespace Modules\Softstore\Jobs;

use App\Services\Agent\AgentClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Modules\Apps\Entities\DockerComposeProject;
use Modules\Softstore\Entities\SoftstoreInstall;
use Modules\Websites\Entities\HostingWebsite;

class InstallSoftstorePackageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public readonly int $installId,
        public readonly string $action = 'install',
    ) {}

    public function handle(AgentClient $agent): void
    {
        $install = SoftstoreInstall::query()->with('package')->find($this->installId);
        if ($install === null || $install->package === null) {
            return;
        }

        $action = in_array($this->action, ['install', 'upgrade', 'uninstall'], true)
            ? $this->action
            : 'install';

        $install->update(['status' => 'running']);

        $options = new \stdClass();
        if ($install->website_id) {
            $website = HostingWebsite::query()->find($install->website_id);
            if ($website !== null) {
                $payload = ['document_root' => $website->document_root];
                if (is_string($website->fqdn) && $website->fqdn !== '') {
                    $payload['domain'] = $website->fqdn;
                }
                $options = (object) $payload;
            }
        }

        $path = $action === 'uninstall' ? '/v1/softstore/uninstall' : '/v1/softstore/install';

        try {
            $result = $agent->post($path, [
                'script_id' => $install->package->agent_script_id,
                'options' => $options,
            ], 600);
        } catch (\Throwable $e) {
            $install->update([
                'status' => 'failed',
                'log' => $e->getMessage(),
            ]);

            return;
        }

        $log = '';
        $data = $result['data'] ?? null;
        if (is_array($data)) {
            $log = (string) ($data['log'] ?? json_encode($data));
        } elseif (is_string($data)) {
            $decoded = json_decode($data, true);
            $log = is_array($decoded)
                ? (string) ($decoded['log'] ?? $data)
                : $data;
        }

        if (! ($result['ok'] ?? false)) {
            $install->update([
                'status' => 'failed',
                'log' => ($result['error'] ?? 'agent error').($log !== '' ? "\n".$log : ''),
            ]);

            return;
        }

        if ($install->package->category === 'docker' && $action !== 'uninstall') {
            $this->syncComposeProject($install->package->agent_script_id, $log);
        }

        if ($install->package->category === 'docker' && $action === 'uninstall') {
            $this->removeComposeProject($install->package->agent_script_id);
        }

        $install->update([
            'status' => 'success',
            'log' => ($action !== 'install' ? '['.$action.'] ' : '').($log !== '' ? $log : 'ok'),
        ]);
    }

    private function removeComposeProject(string $scriptId): void
    {
        $map = [
            'compose_up_redis' => 'softstore-redis',
            'compose_up_nginx' => 'softstore-nginx',
        ];
        $name = $map[$scriptId] ?? null;
        if ($name === null) {
            return;
        }
        DockerComposeProject::query()->where('name', $name)->update([
            'status' => 'removed',
            'last_error' => null,
        ]);
    }

    private function syncComposeProject(string $scriptId, string $log): void
    {
        $map = [
            'compose_up_redis' => [
                'name' => 'softstore-redis',
                'yaml' => "services:\n  redis:\n    image: redis:7-alpine\n    restart: unless-stopped\n    ports:\n      - \"6379:6379\"\n",
            ],
            'compose_up_nginx' => [
                'name' => 'softstore-nginx',
                'yaml' => "services:\n  nginx:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - \"8088:80\"\n",
            ],
        ];
        $meta = $map[$scriptId] ?? null;
        if ($meta === null) {
            return;
        }
        $dir = '/var/lib/webino/compose/'.$meta['name'];
        if (preg_match('/dir=(\S+)/', $log, $m)) {
            $dir = $m[1];
        }
        DockerComposeProject::query()->updateOrCreate(
            ['name' => $meta['name']],
            [
                'project_dir' => $dir,
                'compose_yaml' => $meta['yaml'],
                'status' => 'active',
                'last_error' => null,
            ],
        );
    }
}
