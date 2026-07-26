<?php

namespace Modules\Cron\Services;

class CronTaskBuilder
{
    /**
     * @param  array<string, mixed>  $config
     */
    public function build(string $taskType, array $config, ?string $shellCommand = null): string
    {
        if ($taskType === 'shell' || $taskType === '') {
            return trim((string) $shellCommand);
        }

        $library = config('cron_scripts', []);
        if (! isset($library[$taskType])) {
            throw new \InvalidArgumentException("Unknown cron task type: {$taskType}");
        }

        $entry = $library[$taskType];
        $script = $entry['script'] ?? '';
        $args = [];

        foreach ($entry['params'] ?? [] as $param) {
            $value = $config[$param] ?? '';
            if ($value === '') {
                throw new \InvalidArgumentException("Missing cron param: {$param}");
            }
            $args[] = $this->escapeArg((string) $value);
        }

        $command = $script;
        if ($args !== []) {
            $command .= ' '.implode(' ', $args);
        }

        return $command;
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function library(): array
    {
        return config('cron_scripts', []);
    }

    private function escapeArg(string $value): string
    {
        if (! preg_match('/^[a-zA-Z0-9._@:/-]+$/', $value)) {
            throw new \InvalidArgumentException('Invalid cron argument characters');
        }

        return $value;
    }
}
