<?php

namespace Modules\Apps\Support;

trait DecodesAgentPayload
{
    /**
     * @param  array<string, mixed>  $result
     * @return array<string, mixed>
     */
    protected function agentPayload(array $result): array
    {
        $data = $result['data'] ?? [];
        if (is_string($data)) {
            $decoded = json_decode($data, true);

            return is_array($decoded) ? $decoded : [];
        }

        return is_array($data) ? $data : [];
    }
}
