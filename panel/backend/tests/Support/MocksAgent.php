<?php

namespace Tests\Support;

use App\Services\Agent\AgentClient;
use Mockery\MockInterface;

trait MocksAgent
{
    protected function mockAgent(): MockInterface
    {
        return $this->mock(AgentClient::class, function (MockInterface $mock): void {
            $mock->shouldReceive('post')->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('get')->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('delete')->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('delete')->andReturn(['ok' => true, 'data' => []]);
            $mock->shouldReceive('webina')->andReturn(['ok' => true, 'output' => 'ok']);
        });
    }
}
